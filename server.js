const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const multer = require('multer');
const config = require('./config-helper');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config(); // Load environment variables from .env file

// Add this near the beginning of your file, after loading dotenv
// Check required environment variables
if (!process.env.PRUSA_CONNECT_API_TOKEN) {
    console.warn('Warning: PRUSA_CONNECT_API_TOKEN environment variable not set. Prusa Connect endpoints will not function.');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'temp'));
    },
    filename: (req, file, cb) => {
        const uniqueID = crypto.randomBytes(8).toString('hex');
        cb(null, `${uniqueID}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });


// Configure middleware
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// Create temporary directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
try {
    if (!fs.existsSync(tempDir)) {
        console.log(`Temp directory not found, creating at: ${tempDir}`);
        fs.mkdirSync(tempDir, { recursive: true });
    }
} catch (err) {
    console.error(`Error creating temp directory: ${err}`);
    process.exit(1); // Exit if we can't create the temp directory since it's critical
}

// Initialize PrusaSlicer config
config.initializePrusaSlicerConfig()
    .then(() => console.log('PrusaSlicer config initialized'))
    .catch(err => console.error('Failed to initialize PrusaSlicer config:', err));

// clean up temp files
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if(err) return console.error('Error reading temp directory:', err);

        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            fs.stat(filePath, (err, stats) => {
                if(err) return console.error('Error getting file stats:', err);
                // Remove files older than 1 hour
                if(now - stats.mtimeMs > 3600000) {
                    fs.unlink(filePath, err => {
                        if(err) return console.error('Error deleting file:', err);
                    });
                }
            });
        });
    });

}, 3600000); //Runs every hour

// Endpoint to get available printer profiles
app.get('/api/printer-profiles', (req, res) => {
    try {
        const profiles = config.getPrinterProfiles();
        res.json(profiles);
    } catch(err) {
        console.error('Error getting printer profiles:', err);
        res.status(500).json({ error: 'Failed to get printer profiles', details: err.message });
    }
});

// Endpoint to get available filament profiles
app.get('/api/filament-profiles', (req, res) => {
    try {
        const profiles = config.getFilamentProfiles();
        res.json(profiles);
    } catch(err) {
        console.error('Error getting filament profiles:', err);
        res.status(500).json({ error: 'Failed to get filament profiles', details: err.message });
    }
});


// Endpoint to get available print profiles
app.get('/api/print-profiles', (req, res) => {
    try {
        const profiles = config.getPrintProfiles();
        res.json(profiles);
    } catch(err) {
        console.error('Error getting print profiles:', err);
        res.status(500).json({ error: 'Failed to get print profiles', details: err.message });
    }
});

//Endpoint to convert SCAD code to STL
app.post('/api/convert-scad-to-stl', async (req, res) => {
    try {
        const scadCode = req.body.scadCode;

        if(!scadCode) {
            return res.status(400).send('Missing SCAD code');
        }

        // Generate unique ID for this conversion
        const uniqueID = crypto.randomBytes(8).toString('hex');
        const scadFile = path.join(tempDir, `${uniqueID}.scad`);
        const stlFile = path.join(tempDir, `${uniqueID}.stl`);

        // Write SCAD code to file
        await fs.writeFile(scadFile, scadCode);

        //Add Console log about file creation
        console.log(`SCAD file created at ${scadFile}`);

        // Execute OpenSCAD to convert SCAD to STL
        //TODO: add a timeout or something to indicate if it gets stuck
        try {
            await new Promise((resolve, reject) => {
                exec(`openscad -o "${stlFile}" "${scadFile}"`, (error, stdout, stderr) => {
                    if(error) {
                        reject(error);
                        return;
                    } else {
                        resolve(stdout);
                    }
                });
            });

            // Check if STL file was created
            if(!fs.existsSync(stlFile)) {
                throw new Error('STL file not created');
            }

            // Send STL file
            const stlContent = await fs.readFile(stlFile);

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="model.stl"');
            res.send(stlContent);

            // Clean upi file after sending response
            setTimeout(() => {
                fs.unlink(scadFile, err => {
                    if(err) return console.error('Error deleting SCAD file:', err);
                });
                fs.unlink(stlFile, err => {
                    if(err) return console.error('Error deleting STL file:', err);
                });
            }, 1000);
        } catch(err) {
            console.error('Error executing OpenSCAD:', err);

            try {
                const errorOutput = await fs.readFile(scadFilepath + '.log', 'utf8');
                res.status(500).json({ error: 'OpenSCAD conversion failed', details: errorOutput });
            } catch (readError) {
                res.status(500).json({ error: 'OpenSCAD conversion failed', details: err.message });
            }
        }
    } catch(err) {
        console.error('Error converting SCAD to STL:', err);
        res.status(500).json({ error: 'Conversion failed', details: err.message });
    }
});

// Endpoint to convert stl to G-code using PrusaSlicer - fixed version
app.post('/api/convert-stl-to-gcode', upload.single('stlFile'), async (req, res) => {
    let tempFiles = [];

    try {
        console.log('File upload request received');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);

        // Check if file was uploaded
        let stlFilePath;

        if (req.file?.path) {
            stlFilePath = req.file.path;
            console.log(`STL file received at ${stlFilePath}`);
        } else {
            return res.status(400).json({ error: 'STL file is required. Make sure to use field name "stlFile".' });
        }

        tempFiles.push(stlFilePath);

        // Get printer type and other settings from request
        const printerType = req.body.printerType || 'ORIGINAL_PRUSA_MK4';
        const filamentType = req.body.filamentType || 'Prusament PLA';
        const qualityProfile = req.body.qualityProfile || '0.15mm SPEED';

        console.log(`Using printer: ${printerType}, filament: ${filamentType}, quality: ${qualityProfile}`);

        // Generate unique ID for the conversion
        const uniqueID = crypto.randomBytes(8).toString('hex');
        const gcodeFile = path.join(tempDir, `${uniqueID}.gcode`);
        tempFiles.push(gcodeFile);

        // Execute PrusaSlicer to convert STL to G-code using the config helper
        try {
            const sliceCommand = config.getSliceCommand(stlFilePath, gcodeFile, printerType, filamentType, qualityProfile);
            console.log(`Executing slice command: ${sliceCommand}`);

            await new Promise((resolve, reject) => {
                exec(sliceCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('PrusaSlicer error:', stderr);
                        reject(error);
                        return;
                    } else {
                        resolve(stdout);
                    }
                });
            });

            // Check if G-code file was created
            if (!fs.existsSync(gcodeFile)) {
                throw new Error('G-code file not created');
            }

            // Send G-code file
            const gcodeContent = await fs.readFile(gcodeFile);

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="model.gcode"');
            res.send(gcodeContent);

            console.log(`G-code file successfully sent to client`);

        } catch (err) {
            console.error('Error converting STL to G-code:', err);

            if (!res.headersSent) {
                res.status(500).json({ error: 'Conversion failed', details: err.message });
            }
        }
    } catch (err) {
        console.error('Error processing STL:', err);

        if (!res.headersSent) {
            res.status(500).json({ error: 'Processing failed', details: err.message });
        }
    } finally {
        // Clean up all temporary files
        setTimeout(() => {
            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlink(file, err => {
                        if (err) console.error(`Error deleting file ${file}:`, err);
                    });
                }
            });
        }, 1000);
    }
});

// Endpoint to handle STL data directly
app.post('/api/process-stl', async (req, res) => {
    let tempFiles = [];

    try {
        let stlFilePath;
        let stlData;

        console.log('Request headers:', req.headers['content-type']);
        console.log('Request received for process-stl');

        // Handle form-data with stl field (multipart/form-data)
        if (req.headers['content-type']?.includes('multipart/form-data')) {
            // Use multer to process the uploaded file
            upload.single('stl')(req, res, async function(err) {
                if (err) {
                    console.error('Error in Multer upload:', err);
                    return res.status(400).json({ error: 'File upload failed', details: err.message });
                }

                if (!req.file) {
                    console.error('No file received in multipart/form-data');
                    return res.status(400).json({ error: 'STL file is required. Make sure to use field name "stl".' });
                }

                stlFilePath = req.file.path;
                console.log(`STL file received through multipart/form-data at ${stlFilePath}`);
                tempFiles.push(stlFilePath);

                // Continue with processing the STL file
                try {
                    await processSTLFile();
                } catch (processErr) {
                    console.error('Error in STL processing:', processErr);
                    // Error handling is done inside processSTLFile
                }
            });
            return; // This early return allows the async function in upload.single to finish
        }
        // Check if we're receiving raw STL data in the body
        else if (req.headers['content-type'] === 'application/octet-stream') {
            // Handle binary STL data directly
            stlData = req.body;
            const uniqueID = crypto.randomBytes(8).toString('hex');
            stlFilePath = path.join(tempDir, `${uniqueID}.stl`);
            await fs.writeFile(stlFilePath, stlData);
            tempFiles.push(stlFilePath);
            console.log(`Received raw STL data, saved to ${stlFilePath}`);
        }
        // Check if we're receiving base64 encoded STL
        else if (req.body.stlBase64) {
            const stlBuffer = Buffer.from(req.body.stlBase64, 'base64');
            const uniqueID = crypto.randomBytes(8).toString('hex');
            stlFilePath = path.join(tempDir, `${uniqueID}.stl`);
            await fs.writeFile(stlFilePath, stlBuffer);
            tempFiles.push(stlFilePath);
            console.log(`Received base64 encoded STL data, saved to ${stlFilePath}`);
        }
        // Check if we're receiving a field called 'stl' in JSON format
        else if (req.body.stl) {
            let stlBuffer;
            if (typeof req.body.stl === 'string') {
                // If it's a base64 string
                stlBuffer = Buffer.from(req.body.stl, 'base64');
            } else {
                // If it's an object or array, stringify it
                stlBuffer = Buffer.from(JSON.stringify(req.body.stl));
            }
            const uniqueID = crypto.randomBytes(8).toString('hex');
            stlFilePath = path.join(tempDir, `${uniqueID}.stl`);
            await fs.writeFile(stlFilePath, stlBuffer);
            tempFiles.push(stlFilePath);
            console.log(`Received JSON stl data, saved to ${stlFilePath}`);
        }
        // If no STL data was found
        else {
            console.error('No STL data found in request:', req.body);
            return res.status(400).json({ error: 'No STL data provided. Please send STL data in correct format.' });
        }

        // Function to process the STL file and generate G-code
        async function processSTLFile() {
            // Get printer type and other settings from request
            const printerType = req.body.printerType || 'ORIGINAL_PRUSA_MK4'; // Default to Prusa MK4
            const filamentType = req.body.filamentType || 'Prusament PLA'; // Default to PLA
            const qualityProfile = req.body.qualityProfile || '0.15mm SPEED'; // Default to 0.15mm SPEED

            // Generate unique ID for the gcode file
            const uniqueID = crypto.randomBytes(8).toString('hex');
            const gcodeFile = path.join(tempDir, `${uniqueID}.gcode`);
            tempFiles.push(gcodeFile);

            try {
                const sliceCommand = config.getSliceCommand(stlFilePath, gcodeFile, printerType, filamentType, qualityProfile);
                console.log(`Executing slice command: ${sliceCommand}`);

                await new Promise((resolve, reject) => {
                    exec(sliceCommand, (error, stdout, stderr) => {
                        if (error) {
                            console.error('PrusaSlicer error:', stderr);
                            reject(error);
                            return;
                        } else {
                            resolve(stdout);
                        }
                    });
                });

                // Check if G-code file was created
                if (!fs.existsSync(gcodeFile)) {
                    throw new Error('G-code file not created');
                }

                // Send G-code file
                const gcodeContent = await fs.readFile(gcodeFile);

                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', 'attachment; filename="model.gcode"');
                res.send(gcodeContent);

                console.log(`G-code file successfully sent to client`);

            } catch (err) {
                console.error('Error converting STL to G-code:', err);

                if (!res.headersSent) {
                    res.status(500).json({ error: 'Conversion failed', details: err.message });
                }
            } finally {
                // Clean up temporary files
                setTimeout(() => {
                    tempFiles.forEach(file => {
                        if (fs.existsSync(file)) {
                            fs.unlink(file, err => {
                                if (err) console.error(`Error deleting file ${file}:`, err);
                            });
                        }
                    });
                }, 1000);
            }
        }

        // If we're not using multer (for non-multipart requests), process the STL file now
        if (stlFilePath && !req.headers['content-type']?.includes('multipart/form-data')) {
            await processSTLFile();
        }

    } catch (err) {
        console.error('Error processing STL data:', err);

        if (!res.headersSent) {
            res.status(500).json({ error: 'Processing failed', details: err.message });
        }
    }
});

// Endpoint to convert SCAD code to G-code (combined)
app.post('/api/convert-scad-to-gcode', async (req, res) => {
    let tempFiles = [];

    try {
      const scadCode = req.body.scadCode;

      if(!scadCode) {
        return res.status(400).send('Missing SCAD code');
      }

      // Get Printer type and other settings from request
      const printerType = req.body.printerType || 'ORIGINAL_PRUSA_MK4'; // Default to Prusa MK4
      const filementType = req.body.filementType || 'Prusament PLA'; // Default to PLA
      const qualityPorfile = req.body.qualityPorfile || '0.15mm SPEED'; // Default to 0.15mm SPEED

      // Generate unique IDs for the conversion
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const scadFilePath = path.join(tempDir, `${uniqueId}.scad`);
      const stlFilePath = path.join(tempDir, `${uniqueId}.stl`);
      const gcodeFilePath = path.join(tempDir, `${uniqueId}.gcode`);

      // Add files to cleanup list
      tempFiles.push(scadFilePath, stlFilePath, gcodeFilePath);

      // Write SCAD code to file
      await fs.writeFile(scadFilePath, scadCode);

      try {
        // Step 1: Execute OpenSCAD to convert SCAD to STL
        await new Promise((resolve, reject) => {
          exec(`openscad -o "${stlFilePath}" "${scadFilePath}"`, (error, stdout, stderr) => {
            if(error) {
              reject(error);
              return;
            } else {
              resolve(stdout);
            }
          });
        });

        // Check if STL file was created
        if(!fs.existsSync(stlFilePath)) {
          throw new Error('STL file not created');
        }

        // Step 2: Execute PrusaSlicer to convert STL to G-code
        const sliceCommand = config.getSliceCommand(stlFilePath, gcodeFilePath, printerType, filementType, qualityPorfile);

        console.log('Executing slice command:', sliceCommand);

        await new Promise((resolve, reject) => {
          exec(sliceCommand, (error, stdout, stderr) => {
            if(error) {
              reject(error);
              return;
            } else {
              resolve(stdout);
            }
          });
        });

        // Check if G-code file was created
        if(!fs.existsSync(gcodeFilePath)) {
          throw new Error('G-code file not created');
        }

        // Send G-code file
        const gcodeContent = await fs.readFile(gcodeFilePath);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="model.gcode"');
        res.send(gcodeContent);

      } catch(err) {
        console.error('Error in conversion process:', err);

        // Only respond if headers haven't been sent yet
        if (!res.headersSent) {
          res.status(500).json({ error: 'Conversion failed', details: err.message });
        }
      }
    } catch(err) {
      console.error('Error converting SCAD to G-code:', err);

      // Only respond if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({ error: 'Conversion failed', details: err.message });
      }
    } finally {
      // Clean up all temporary files
      setTimeout(() => {
        tempFiles.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlink(file, err => {
              if (err) console.error(`Error deleting file ${file}:`, err);
            });
          }
        });
      }, 1000);
    }
  });

  //TODO: Add so that when done sending STL back it should start printing --> Make the printer setup and send it over internet. too.
// Endpoint to use existing SCAD files with button layout parameter
app.post('/api/convert-to-scad', async (req, res) => {
    let tempFiles = [];

    try {
        console.log('Received request body:', req.body);

        // Check if buttonLayout exists and handle different formats
        let buttonLayout;
        let buttonParams;

        if (req.body.buttonLayout) {
            buttonLayout = req.body.buttonLayout;
        } else if (typeof req.body === 'string') {
            // Try to parse if it's a string
            try {
                const parsed = JSON.parse(req.body);
                buttonLayout = parsed.buttonLayout;
                buttonParams = parsed.buttonParams;
            } catch (e) {
                console.error('Failed to parse request body as JSON:', e);
            }
        } else if (req.body.scadCommand) {
            // Extract from scadCommand if that's how it's being sent
            // Handle button_layout
            const layoutMatch = req.body.scadCommand.match(/button_layout=(\[\[.*?\]\])/);
            if (layoutMatch && layoutMatch[1]) {
                try {
                    buttonLayout = JSON.parse(layoutMatch[1].replace(/'/g, '"'));
                } catch (e) {
                    console.error('Failed to parse buttonLayout from scadCommand:', e);
                }
            }

            // Handle button_params if included in scadCommand
            const paramsMatch = req.body.scadCommand.match(/button_params=(\[.*?\])/);
            if (paramsMatch && paramsMatch[1]) {
                try {
                    buttonParams = JSON.parse(paramsMatch[1].replace(/'/g, '"'));
                } catch (e) {
                    console.error('Failed to parse buttonParams from scadCommand:', e);
                }
            }
        }

        // Also check for explicit buttonParams in the request body
        if (req.body.buttonParams && !buttonParams) {
            buttonParams = req.body.buttonParams;
        }

        console.log('Parsed buttonLayout:', buttonLayout);
        console.log('Parsed buttonParams:', buttonParams);

        if (!buttonLayout) {
            return res.status(400).send('Missing or invalid button layout configuration');
        }

        // Generate unique ID for this conversion
        const uniqueID = crypto.randomBytes(8).toString('hex');
        const outputScadFile = path.join(tempDir, `${uniqueID}_output.scad`);
        const stlFile = path.join(tempDir, `${uniqueID}.stl`);
        const logFile = path.join(tempDir, `${uniqueID}.log`);

        // Add files to cleanup list
        tempFiles.push(outputScadFile, stlFile, logFile);

        // Path to the existing SCAD files
        const inputDeviceScad = path.join(__dirname, 'input_device.scad');
        const parametricButtonScad = path.join(__dirname, 'ParametricButton.scad');

        // Check if the necessary SCAD files exist
        if (!fs.existsSync(inputDeviceScad) || !fs.existsSync(parametricButtonScad)) {
            console.error(`Missing SCAD files. inputDeviceScad exists: ${fs.existsSync(inputDeviceScad)}, parametricButtonScad exists: ${fs.existsSync(parametricButtonScad)}`);
            return res.status(500).send('Required SCAD files not found');
        }

        // Format button layout for OpenSCAD
        // OpenSCAD needs arrays formatted with specific syntax
        function formatArrayForOpenSCAD(arr) {
            if (Array.isArray(arr)) {
                return `[${arr.map(item => {
                    if (Array.isArray(item)) {
                        return formatArrayForOpenSCAD(item);
                    } else if (typeof item === 'string') {
                        return `"${item}"`;
                    } else {
                        return item;
                    }
                }).join(',')}]`;
            }
            return arr;
        }

        // Create a new SCAD file that imports the existing files and passes the button layout and params
        let scadContent = `
include <${inputDeviceScad.replace(/\\/g, '/')}>
include <${parametricButtonScad.replace(/\\/g, '/')}>

// Button layout configuration
button_layout = ${formatArrayForOpenSCAD(buttonLayout)};
`;

        // Add button_params if provided
        if (buttonParams) {
            scadContent += `
// Button parameters
button_params = ${formatArrayForOpenSCAD(buttonParams)};
`;
        }

        // Write the combined SCAD code to file
       // await fs.writeFile(outputScadFile, scadContent);

        console.log(`Combined SCAD file created at ${outputScadFile}`);
        console.log(`SCAD content: ${scadContent}`);

        // Execute OpenSCAD to convert SCAD to STL with output to log file
        try {
            console.log(`Starting OpenSCAD conversion of ${outputScadFile} to ${stlFile}`);

            // Use --debug all flag to get more verbose output
            const openScadCmd = `openscad --debug all -q -o "${stlFile}" "${inputDeviceScad}" -D "ThreexLayout=${formatArrayForOpenSCAD(buttonLayout)}" -D "button_params=${formatArrayForOpenSCAD(buttonParams)}"`;
            console.log(`Running command: ${openScadCmd}`);

            await new Promise((resolve, reject) => {
                // Capture both stdout and stderr
                const process = exec(
                    openScadCmd,
                    {maxBuffer: 5 * 1024 * 1024}, // Increase buffer size to 5MB
                    (error, stdout, stderr) => {
                        // Write any output to the log file
                        fs.writeFileSync(logFile, `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`);

                        if (error) {
                            console.error('OpenSCAD error output:', stderr);
                            reject(error);
                            return;
                        } else {
                            resolve(stdout);
                        }
                    }
                );

                // Set a timeout in case OpenSCAD hangs
                setTimeout(() => {
                    process.kill();
                    reject(new Error('OpenSCAD operation timed out after 3 minutes'));
                }, 1480000); // 3 minute timeout
            });

            // Check if STL file was created and has valid content
            if (!fs.existsSync(stlFile)) {
                throw new Error('STL file not created');
            }

            const stats = fs.statSync(stlFile);
            if (stats.size === 0) {
                throw new Error('STL file was created but is empty');
            }

            console.log(`STL file successfully created: ${stlFile} (${stats.size} bytes)`);

            // Send STL file
            const stlContent = await fs.readFile(stlFile);

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="button_device.stl"');
            res.send(stlContent);

            console.log(`STL file successfully sent to client`);

        } catch (err) {
            console.error('Error executing OpenSCAD:', err);

            // Try to read the log file for more details
            try {
                if (fs.existsSync(logFile)) {
                    const logContent = fs.readFileSync(logFile, 'utf8');
                    console.error("OpenSCAD log:", logContent);

                    // Only respond if headers haven't been sent yet
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'OpenSCAD conversion failed',
                            details: err.message,
                            log: logContent
                        });
                    }
                } else {
                    // Only respond if headers haven't been sent yet
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'OpenSCAD conversion failed',
                            details: err.message
                        });
                    }
                }
            } catch (logErr) {
                console.error("Failed to read log file:", logErr);

                // Only respond if headers haven't been sent yet
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'OpenSCAD conversion failed',
                        details: err.message
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error in SCAD processing:', err);

        // Only respond if headers haven't been sent yet
        if (!res.headersSent) {
            res.status(500).json({ error: 'Processing failed', details: err.message });
        }
    } finally {
        // Clean up all temporary files
        setTimeout(() => {
            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlink(file, err => {
                        if (err) console.error(`Error deleting file ${file}:`, err);
                    });
                }
            });
        }, 1000);
    }
});

// Endpoint to slice and start printing via Prusa Connect
app.post('/api/print-via-prusa-connect', upload.single('stlFile'), async (req, res) => {
    let tempFiles = [];

    try {
        console.log('Print via Prusa Connect request received');

        // Get STL file path - either from uploaded file or use placeholder
        let stlFilePath;
        if (req.file?.path) {
            stlFilePath = req.file.path;
            console.log(`STL file received at ${stlFilePath}`);
            tempFiles.push(stlFilePath);
        } else {
            // Use placeholder file if no file was uploaded
            stlFilePath = path.join(__dirname, 'assets', 'placeholder.stl');
            console.log(`Using placeholder STL file at ${stlFilePath}`);

            // Check if placeholder exists
            if (!fs.existsSync(stlFilePath)) {
                // Create assets directory if it doesn't exist
                const assetsDir = path.join(__dirname, 'assets');
                if (!fs.existsSync(assetsDir)) {
                    fs.mkdirSync(assetsDir, { recursive: true });
                    console.log(`Created assets directory at ${assetsDir}`);
                }

                return res.status(400).json({
                    error: 'No STL file provided and placeholder file not found. Please upload an STL file or create a placeholder.stl file in the assets directory.'
                });
            }
        }

        // Get printer and slicing settings
        const printerName = req.body.printerName || 'MK4 Master Thesis';
        const printerType = req.body.printerType || 'ORIGINAL_PRUSA_MK4';
        const filamentType = req.body.filamentType || 'Prusament PLA';
        const qualityProfile = req.body.qualityProfile || '0.15mm SPEED';

        // Prusa Connect API credentials from environment variables
        const PRUSA_CONNECT_API_TOKEN = process.env.PRUSA_CONNECT_API_TOKEN;

        // Use the API URL that we found working
        const PRUSA_CONNECT_API_URL = 'https://connect.prusa3d.com/api';

        if (!PRUSA_CONNECT_API_TOKEN) {
            console.error('PRUSA_CONNECT_API_TOKEN environment variable not set');
            return res.status(500).json({
                error: 'Prusa Connect API token not configured. Please set the PRUSA_CONNECT_API_TOKEN environment variable.'
            });
        }

        // First, we need to get the printer ID for the specified printer
        let printerID;
        try {
            console.log(`Fetching printers from ${PRUSA_CONNECT_API_URL}/printer`);

            const printersResponse = await axios.get(`${PRUSA_CONNECT_API_URL}/printer`, {
                headers: {
                    'Authorization': `Bearer ${PRUSA_CONNECT_API_TOKEN}`
                }
            });

            console.log('Prusa Connect API response received');

            // Check if the response data structure is as expected
            if (!printersResponse.data || !printersResponse.data.printers) {
                console.error('Unexpected API response format:', JSON.stringify(printersResponse.data, null, 2));
                return res.status(500).json({
                    error: 'Unexpected response format from Prusa Connect API',
                    response: printersResponse.data
                });
            }

            // Log available printers for debugging
            console.log('Available printers:', printersResponse.data.printers.map(p => p.name));

            const printer = printersResponse.data.printers.find(p =>
                p.name === printerName || p.name.includes(printerName)
            );

            if (!printer) {
                return res.status(404).json({
                    error: `Printer "${printerName}" not found in your Prusa Connect account`,
                    availablePrinters: printersResponse.data.printers.map(p => p.name),
                    message: 'Please check the printer name or update the printerName parameter to match one of the available printers.'
                });
            }

            printerID = printer.id;
            console.log(`Found printer "${printer.name}" with ID: ${printerID}`);

        } catch (err) {
            console.error('Error fetching printers from Prusa Connect:', err);

            // Log more detailed error information
            if (err.response) {
                console.error('API error response:', {
                    status: err.response.status,
                    data: err.response.data,
                    headers: err.response.headers
                });

                // Handle specific error codes
                if (err.response.status === 401) {
                    return res.status(401).json({
                        error: 'Authentication failed. Your Prusa Connect API token may be invalid or expired.',
                        details: err.response.data
                    });
                } else if (err.response.status === 404) {
                    return res.status(404).json({
                        error: 'API endpoint not found. The Prusa Connect API URL may have changed.',
                        details: err.response.data
                    });
                }
            } else if (err.request) {
                console.error('No response received:', err.request);

                return res.status(503).json({
                    error: 'No response received from Prusa Connect API. The service may be down or unavailable.',
                    details: 'Network request was sent but no response was received'
                });
            }

            return res.status(500).json({
                error: 'Failed to connect to Prusa Connect API',
                details: err.message
            });
        }

        // Upload the STL file to Prusa Connect
        let uploadResponse;
        try {
            console.log(`Uploading STL file to printer ${printerID}`);

            const formData = new FormData();
            formData.append('file', fs.createReadStream(stlFilePath), {
                filename: path.basename(stlFilePath),
                contentType: 'application/sla'
            });

            uploadResponse = await axios.post(
                `${PRUSA_CONNECT_API_URL}/printers/${printerID}/files`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${PRUSA_CONNECT_API_TOKEN}`,
                        ...formData.getHeaders()
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            console.log('File uploaded successfully to Prusa Connect');

        } catch (err) {
            console.error('Error uploading file to Prusa Connect:', err);

            if (err.response) {
                console.error('Upload error response:', {
                    status: err.response.status,
                    data: err.response.data
                });

                // Handle specific error codes for upload
                if (err.response.status === 413) {
                    return res.status(413).json({
                        error: 'File too large for Prusa Connect API',
                        details: err.response.data
                    });
                }
            }

            return res.status(500).json({
                error: 'Failed to upload file to Prusa Connect',
                details: err.message
            });
        }

        // Get file ID and name from the upload response
        let fileID, fileName;

        try {
            fileID = uploadResponse.data.id;
            fileName = uploadResponse.data.name;

            console.log(`File uploaded with ID: ${fileID}, name: ${fileName}`);

            if (!fileID) {
                throw new Error('File ID missing from upload response');
            }
        } catch (err) {
            console.error('Error parsing upload response:', err);
            console.error('Upload response data:', uploadResponse.data);

            return res.status(500).json({
                error: 'Failed to get file ID from upload response',
                details: err.message,
                responseData: uploadResponse.data
            });
        }

        // Start slicing and printing the file
        try {
            console.log(`Starting slice-and-print operation for file ${fileID}`);

            // Prepare the slice and print request payload
            const sliceAndPrintPayload = {
                file_id: fileID,
                printer_profile: printerType,
                filament_profile: filamentType,
                print_profile: qualityProfile
            };

            console.log('Slice and print payload:', sliceAndPrintPayload);

            // Request slicing with the specified parameters
            const printResponse = await axios.post(
                `${PRUSA_CONNECT_API_URL}/printers/${printerID}/slice-and-print`,
                sliceAndPrintPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${PRUSA_CONNECT_API_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`File "${fileName}" slicing and printing started on printer "${printerName}"`);
            console.log('Print response:', printResponse.data);

            return res.status(200).json({
                message: `Print job started on ${printerName}`,
                printer: printerName,
                file: fileName,
                printer_id: printerID,
                file_id: fileID,
                print_response: printResponse.data
            });

        } catch (err) {
            console.error('Error starting print job on Prusa Connect:', err);

            if (err.response) {
                console.error('Print error response:', {
                    status: err.response.status,
                    data: err.response.data
                });
            }

            return res.status(500).json({
                error: 'Failed to start print job on Prusa Connect',
                details: err.message,
                response: err.response?.data
            });
        }

    } catch (err) {
        console.error('Error in Prusa Connect print process:', err);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Print process failed',
                details: err.message
            });
        }
    } finally {
        // Clean up temporary files
        setTimeout(() => {
            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlink(file, err => {
                        if (err) console.error(`Error deleting file ${file}:`, err);
                    });
                }
            });
        }, 1000);
    }
});

// Endpoint to test Prusa Connect API connection
app.get('/api/test-prusa-connect', async (req, res) => {
    try {
        const PRUSA_CONNECT_API_TOKEN = process.env.PRUSA_CONNECT_API_TOKEN;

        if (!PRUSA_CONNECT_API_TOKEN) {
            return res.status(500).json({
                error: 'Prusa Connect API token not configured. Please set the PRUSA_CONNECT_API_TOKEN environment variable.'
            });
        }

        // Try different API URLs
        const possibleApiUrls = [
            'https://connect.prusa3d.com/c/api',
            'https://connect.prusa3d.com/',
            'https://connect.prusa3d.com/api'
        ];

        let successful = false;
        let responseData = null;
        let error = null;

        for (const apiUrl of possibleApiUrls) {
            try {
                console.log(`Testing Prusa Connect API URL: ${apiUrl}`);

                const response = await axios.get(`${apiUrl}/printers`, {
                    headers: {
                        'Authorization': `Bearer ${PRUSA_CONNECT_API_TOKEN}`
                    }
                });

                successful = true;
                responseData = response.data;
                console.log('API test successful with URL:', apiUrl);
                break;
            } catch (err) {
                error = err;
                console.error(`API test failed with URL ${apiUrl}:`, err.message);
            }
        }

        if (successful) {
            return res.status(200).json({
                message: 'Successfully connected to Prusa Connect API',
                data: responseData
            });
        } else {
            return res.status(500).json({
                error: 'Failed to connect to Prusa Connect API with all possible URLs',
                details: error.message
            });
        }
    } catch (err) {
        console.error('Error testing Prusa Connect API:', err);

        return res.status(500).json({
            error: 'Test failed',
            details: err.message
        });
    }
});

// Endpoint to slice and directly send to printer using PrusaSlicer
app.post('/api/slice-and-print-direct', upload.single('stlFile'), async (req, res) => {
    let tempFiles = [];

    try {
        console.log('Slice and print direct request received');

        // Get STL file path - either from uploaded file or use placeholder
        let stlFilePath;
        if (req.file?.path) {
            stlFilePath = req.file.path;
            console.log(`STL file received at ${stlFilePath}`);
            tempFiles.push(stlFilePath);
        } else {
            // Use placeholder file if no file was uploaded
            stlFilePath = path.join(__dirname, 'assets', 'placeholder.stl');
            console.log(`Using placeholder STL file at ${stlFilePath}`);

            // Check if placeholder exists
            if (!fs.existsSync(stlFilePath)) {
                // Create assets directory if it doesn't exist
                const assetsDir = path.join(__dirname, 'assets');
                if (!fs.existsSync(assetsDir)) {
                    fs.mkdirSync(assetsDir, { recursive: true });
                    console.log(`Created assets directory at ${assetsDir}`);
                }

                return res.status(400).json({
                    error: 'No STL file provided and placeholder file not found. Please upload an STL file or create a placeholder.stl file in the assets directory.'
                });
            }
        }

        // Get printer and slicing settings
        // Use the full printer preset name as configured in PrusaSlicer
        const printerPreset = req.body.printerPreset || 'MK4 Master Thesis * Original Prusa MK4 Input Shaper 0.4 nozzle';
        const filamentType = req.body.filamentType || 'Prusament PLA';
        const qualityProfile = req.body.qualityProfile || '0.15mm SPEED';

        // Generate a temp gcode file path
        const uniqueID = crypto.randomBytes(8).toString('hex');
        const gcodeFilePath = path.join(tempDir, `${uniqueID}.gcode`);
        tempFiles.push(gcodeFilePath);

        // Find the PrusaSlicer executable
        const prusaSlicerPath = config.findPrusaSlicerExecutable();
        if (!prusaSlicerPath) {
            return res.status(500).json({
                error: 'PrusaSlicer executable not found. Please make sure PrusaSlicer is installed correctly.'
            });
        }

        console.log(`Using PrusaSlicer at: ${prusaSlicerPath}`);

        try {
            // PrusaSlicer command using the complete preset name
            // Format: prusa-slicer-console --export-gcode --printer "printer_preset" --filament "filament_preset" --print "print_preset" --output "output.gcode" "input.stl"
            const sliceAndPrintCmd = `"${prusaSlicerPath}" --export-gcode --printer "${printerPreset}" --filament "${filamentType}" --print "${qualityProfile}" --output "${gcodeFilePath}" "${stlFilePath}"`;

            console.log(`Executing slice and print command: ${sliceAndPrintCmd}`);

            // Execute PrusaSlicer to slice the model
            await new Promise((resolve, reject) => {
                exec(sliceAndPrintCmd, {maxBuffer: 5 * 1024 * 1024}, (error, stdout, stderr) => {
                    if (error) {
                        console.error('PrusaSlicer error output:', stderr);
                        reject(error);
                    } else {
                        console.log('PrusaSlicer stdout:', stdout);
                        resolve(stdout);
                    }
                });
            });

            // Check if G-code file was created
            if (!fs.existsSync(gcodeFilePath)) {
                throw new Error('G-code file not created. PrusaSlicer failed to slice the model.');
            }

            // Now we need to send the G-code file to the printer
            // This can be done using PrusaSlicer's built-in upload command, OS print commands,
            // or by returning the G-code file for the frontend to handle

            // For this example, we'll use PrusaSlicer's built-in upload functionality if available
            // Otherwise, we'll return the G-code file to the client

            try {
                // Create a command to upload to printer using PrusaSlicer
                // Note: This might not be supported in all versions, so we'll have a fallback
                const uploadCmd = `"${prusaSlicerPath}" --upload "${gcodeFilePath}" --printer "${printerPreset}"`;

                console.log(`Attempting to upload directly to printer with command: ${uploadCmd}`);

                await new Promise((resolve, reject) => {
                    exec(uploadCmd, {maxBuffer: 5 * 1024 * 1024}, (error, stdout, stderr) => {
                        if (error) {
                            console.warn('Direct upload to printer failed, will return G-code file instead:', stderr);
                            resolve(false); // Continue execution but indicate failure
                        } else {
                            console.log('Upload to printer succeeded:', stdout);
                            resolve(true);
                        }
                    });
                });

                // If we reach here, the command ran but might have failed
                // Let's check if the G-code file still exists (if it was successfully sent, some versions delete it)
                const fileStillExists = fs.existsSync(gcodeFilePath);

                if (!fileStillExists) {
                    console.log('G-code file was removed, assuming successful upload to printer');

                    return res.status(200).json({
                        message: `Print job successfully sent to printer "${printerPreset}"`,
                        printer: printerPreset,
                        file: path.basename(stlFilePath),
                        method: 'direct_upload'
                    });
                } else {
                    console.log('G-code file still exists, sending to client for manual printing');

                    // Read the G-code file content
                    const gcodeContent = await fs.readFile(gcodeFilePath);

                    // Send the G-code file to the client
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.setHeader('Content-Disposition', `attachment; filename="${printerPreset}_${path.basename(stlFilePath, '.stl')}.gcode"`);
                    res.send(gcodeContent);

                    console.log(`G-code file sent to client for manual upload to printer`);
                }

            } catch (uploadErr) {
                console.error('Error during printer upload attempt:', uploadErr);

                // Fall back to sending the G-code file to the client
                const gcodeContent = await fs.readFile(gcodeFilePath);

                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${printerPreset}_${path.basename(stlFilePath, '.stl')}.gcode"`);
                res.send(gcodeContent);

                console.log(`G-code file sent to client as fallback`);
            }

        } catch (err) {
            console.error('Error slicing and sending to printer:', err);

            return res.status(500).json({
                error: 'Failed to slice and send to printer',
                details: err.message
            });
        }

    } catch (err) {
        console.error('Error in direct print process:', err);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Print process failed',
                details: err.message
            });
        }
    } finally {
        // Clean up temporary files
        setTimeout(() => {
            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlink(file, err => {
                        if (err) console.error(`Error deleting file ${file}:`, err);
                    });
                }
            });
        }, 1000);
    }
});

// Endpoint to generate design previews as PNG images
app.post('/api/generate-previews', async (req, res) => {
    let tempFiles = [];

    try {
        console.log('Generate preview images request received');

        // Log the entire request body for debugging
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        // Path to the existing SCAD files - Define these at the beginning of the function
        const inputDeviceScad = path.join(__dirname, 'input_device.scad');
        const parametricButtonScad = path.join(__dirname, 'ParametricButton.scad');

        // Check if the necessary SCAD files exist
        if (!fs.existsSync(inputDeviceScad) || !fs.existsSync(parametricButtonScad)) {
            console.error(`Missing SCAD files. inputDeviceScad exists: ${fs.existsSync(inputDeviceScad)}, parametricButtonScad exists: ${fs.existsSync(parametricButtonScad)}`);
            return res.status(500).send('Required SCAD files not found');
        }

        // Get designs from the request body
        let designs = [];

        // Check different possible structures of the request body
        if (req.body.designs && Array.isArray(req.body.designs)) {
            designs = req.body.designs;
            console.log('Found designs array in req.body.designs');
        } else if (Array.isArray(req.body)) {
            designs = req.body;
            console.log('Request body is directly an array of designs');
        } else if (req.body.design) {
            // Handle case where a single design is sent under 'design' property
            designs = [req.body.design];
            console.log('Found single design in req.body.design');
        } else if (req.body.count) {
            // This is just the count parameter, actual designs may be elsewhere
            console.log(`Request contained count: ${req.body.count} but no designs`);
            // You might want to return an error or generate random designs here
            return res.status(400).json({
                error: 'Request contains count parameter but no actual designs. Please provide designs in the request.'
            });
        }

        if (!designs || designs.length === 0) {
            return res.status(400).json({
                error: 'Missing or invalid designs array. Please provide a valid array of designs.',
                receivedBody: req.body
            });
        }

        console.log(`Received ${designs.length} designs to generate previews for`);

        // Log each design ID for debugging
        designs.forEach((design, index) => {
            console.log(`Design ${index + 1} ID: ${design.id || 'unknown'}`);
        });

        // Generate previews for each design
        const previewResults = [];

        for (const design of designs) {
            try {
                // Generate unique ID for this preview
                const uniqueID = crypto.randomBytes(8).toString('hex');
                const stlFile = path.join(tempDir, `${uniqueID}.stl`);
                const pngFile = path.join(tempDir, `${uniqueID}.png`);
                const logFile = path.join(tempDir, `${uniqueID}.log`);

                // Add files to cleanup list
                tempFiles.push(stlFile, pngFile, logFile);

                // Format arrays for OpenSCAD
                function formatArrayForOpenSCAD(arr) {
                    if (Array.isArray(arr)) {
                        return `[${arr.map(item => {
                            if (Array.isArray(item)) {
                                return formatArrayForOpenSCAD(item);
                            } else if (typeof item === 'string') {
                                return `"${item}"`;
                            } else {
                                return item;
                            }
                        }).join(',')}]`;
                    }
                    return arr;
                }

                // Extract necessary design data
                const buttonLayout = design.button_layout;
                const buttonParams = design.button_params;

                if (!buttonLayout) {
                    console.error(`Design ${design.id || 'unknown'} is missing button_layout`);
                    throw new Error('Missing button_layout in design');
                }

                if (!buttonParams) {
                    console.log(`Design ${design.id || 'unknown'} is missing button_params, will use defaults`);
                    // You might want to use default parameters here
                }

                console.log(`Generating preview for design ID: ${design.id || 'unknown'}`);

                // Create an intermediate SCAD file that includes the layout
                const tempScadFile = path.join(tempDir, `${uniqueID}_input.scad`);
                tempFiles.push(tempScadFile);

                // Format the SCAD content
                const scadContent = `
include <${inputDeviceScad.replace(/\\/g, '/')}>
include <${parametricButtonScad.replace(/\\/g, '/')}>

// Button layout configuration
ThreexLayout = ${formatArrayForOpenSCAD(buttonLayout)};

// Button parameters
button_params = ${formatArrayForOpenSCAD(buttonParams)};

// Visualization settings
SHOW_ASSEMBLED = true;
SHOW_BUTTONS = true;
BUTTON_VISUAL_SCALE = 1;
`;

                // Write the content to the file
                await fs.writeFile(tempScadFile, scadContent);

                // Change the OpenSCAD command to use the file directly
                const openScadCmd = `openscad --preview -o "${pngFile}" --imgsize=800,600 --colorscheme=Tomorrow "${tempScadFile}"`;

                console.log(`Running OpenSCAD preview command for design ${design.id || 'unknown'}`);

                // Execute OpenSCAD to render PNG
                await new Promise((resolve, reject) => {
                    const process = exec(
                        openScadCmd,
                        {maxBuffer: 5 * 1024 * 1024},
                        (error, stdout, stderr) => {
                            // Write any output to the log file
                            fs.writeFileSync(logFile, `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`);

                            if (error) {
                                console.error(`OpenSCAD error for design ${design.id}:`, stderr);
                                reject(error);
                                return;
                            } else {
                                resolve(stdout);
                            }
                        }
                    );

                    // Set a timeout
                    setTimeout(() => {
                        process.kill();
                        reject(new Error('OpenSCAD operation timed out after 60 seconds'));
                    }, 60000); // 60 second timeout for previews
                });

                // Check if PNG file was created
                if (!fs.existsSync(pngFile)) {
                    throw new Error(`PNG preview for design ${design.id} was not created`);
                }

                // Read the PNG file as base64
                const pngData = await fs.readFile(pngFile);
                const pngBase64 = pngData.toString('base64');

                // Add preview data to results
                previewResults.push({
                    id: design.id,
                    type: design.type,
                    preview: `data:image/png;base64,${pngBase64}`
                });

                console.log(`Successfully generated preview for design ${design.id}`);

            } catch (designErr) {
                console.error(`Error generating preview for design ${design.id}:`, designErr);

                // Add error information to results instead of failing the whole request
                previewResults.push({
                    id: design.id,
                    type: design.type,
                    error: designErr.message,
                    preview: null
                });
            }
        }

        // Return the generated previews
        res.status(200).json(previewResults);

    } catch (err) {
        console.error('Error generating previews:', err);
        res.status(500).json({ error: 'Failed to generate previews', details: err.message });
    } finally {
        // Clean up temporary files
        setTimeout(() => {
            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlink(file, err => {
                        if (err) console.error(`Error deleting file ${file}:`, err);
                    });
                }
            });
        }, 1000);
    }
});

// Endpoint to generate a single preview
app.post('/api/generate-single-preview', async (req, res) => {
    let tempFiles = [];

    try {
        console.log('Generate single preview request received');

        // Get design from the request body
        const { design } = req.body;

        if (!design || !design.button_layout || !design.button_params) {
            return res.status(400).json({
                error: 'Missing or invalid design. Please provide a valid design with button_layout and button_params.'
            });
        }

        // Generate unique ID for this preview
        const uniqueID = crypto.randomBytes(8).toString('hex');
        const pngFile = path.join(tempDir, `${uniqueID}.png`);
        const logFile = path.join(tempDir, `${uniqueID}.log`);

        // Add files to cleanup list
        tempFiles.push(pngFile, logFile);

        // Path to the existing SCAD files
        const inputDeviceScad = path.join(__dirname, 'input_device.scad');
        const parametricButtonScad = path.join(__dirname, 'ParametricButton.scad');

        // Format arrays for OpenSCAD
        function formatArrayForOpenSCAD(arr) {
            if (Array.isArray(arr)) {
                return `[${arr.map(item => {
                    if (Array.isArray(item)) {
                        return formatArrayForOpenSCAD(item);
                    } else if (typeof item === 'string') {
                        return `"${item}"`;
                    } else {
                        return item;
                    }
                }).join(',')}]`;
            }
            return arr;
        }

        // Execute OpenSCAD to render a PNG preview
        const buttonLayout = design.button_layout;
        const buttonParams = design.button_params;

        // OpenSCAD command for rendering to PNG
        const openScadCmd = `openscad --render -o "${pngFile}" --imgsize=800,600 --colorscheme=Tomorrow --camera=0,0,150,55,0,35,750 "${inputDeviceScad}" -D "button_layout=${formatArrayForOpenSCAD(buttonLayout)}" -D "button_params=${formatArrayForOpenSCAD(buttonParams)}"`;

        console.log(`Running OpenSCAD preview command for design ${design.id || 'unknown'}`);

        await new Promise((resolve, reject) => {
            const process = exec(
                openScadCmd,
                {maxBuffer: 5 * 1024 * 1024},
                (error, stdout, stderr) => {
                    // Write any output to the log file
                    fs.writeFileSync(logFile, `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`);

                    if (error) {
                        console.error('OpenSCAD error output:', stderr);
                        reject(error);
                        return;
                    } else {
                        resolve(stdout);
                    }
                }
            );

            // Set a timeout
            setTimeout(() => {
                process.kill();
                reject(new Error('OpenSCAD operation timed out after 60 seconds'));
            }, 60000); // 60 second timeout for previews
        });

        // Check if PNG file was created
        if (!fs.existsSync(pngFile)) {
            throw new Error('PNG preview was not created');
        }

        // Read the PNG file as base64
        const pngData = await fs.readFile(pngFile);
        const pngBase64 = pngData.toString('base64');

        // Return the preview
        res.status(200).json({
            id: design.id || uniqueID,
            type: design.type || 'Button Panel',
            preview: `data:image/png;base64,${pngBase64}`
        });

        console.log(`Successfully generated preview for design`);

    } catch (err) {
        console.error('Error generating single preview:', err);
        res.status(500).json({ error: 'Failed to generate preview', details: err.message });
    } finally {
        // Clean up temporary files
        setTimeout(() => {
            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlink(file, err => {
                        if (err) console.error(`Error deleting file ${file}:`, err);
                    });
                }
            });
        }, 1000);
    }
});

// Endpoint to generate STL from a selected design
app.post('/api/generate-stl', async (req, res) => {
    let tempFiles = [];

    try {
        console.log('Generate STL from design request received');
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        // Extract design data - handle different possible formats
        let design;
        let designId;
        let buttonLayout;
        let buttonParams;

        // Check for design ID in various formats
        if (req.body.designId) {
            designId = req.body.designId;
            console.log(`Received designId: ${designId}`);

            // Try to parse numeric ID from string ID (e.g., "design_2" -> 2)
            let numericId = null;
            if (typeof designId === 'string') {
                const matches = designId.match(/(\d+)$/);
                if (matches && matches[1]) {
                    numericId = parseInt(matches[1], 10);
                    console.log(`Extracted numeric ID ${numericId} from designId ${designId}`);
                }
            }

            // Check if the full design is also provided
            if (req.body.design) {
                design = req.body.design;
                console.log('Design object included with designId');

                // Check for nested button layout structure
                if (design.params && design.params.buttonLayout) {
                    buttonLayout = design.params.buttonLayout;
                    console.log('Found buttonLayout in design.params');
                }

                if (design.params && design.params.buttonParams) {
                    buttonParams = design.params.buttonParams;
                    console.log('Found buttonParams in design.params');
                }

                // Direct properties check
                if (design.button_layout) {
                    buttonLayout = design.button_layout;
                    console.log('Found buttonLayout directly in design object');
                }

                if (design.buttonLayout) {
                    buttonLayout = design.buttonLayout;
                    console.log('Found buttonLayout (camelCase) directly in design object');
                }

                if (design.button_params) {
                    buttonParams = design.button_params;
                    console.log('Found buttonParams directly in design object');
                }

                if (design.buttonParams) {
                    buttonParams = design.buttonParams;
                    console.log('Found buttonParams (camelCase) directly in design object');
                }
            }
        }

        // If we still don't have button layout and params, check other request properties
        if (!buttonLayout) {
            // Check direct request properties
            if (req.body.button_layout) {
                buttonLayout = req.body.button_layout;
                console.log('Found buttonLayout directly in request');
            } else if (req.body.buttonLayout) {
                buttonLayout = req.body.buttonLayout;
                console.log('Found buttonLayout (camelCase) directly in request');
            } else if (req.body.params && req.body.params.buttonLayout) {
                buttonLayout = req.body.params.buttonLayout;
                console.log('Found buttonLayout in request.params');
            }
        }

        if (!buttonParams) {
            // Check direct request properties
            if (req.body.button_params) {
                buttonParams = req.body.button_params;
                console.log('Found buttonParams directly in request');
            } else if (req.body.buttonParams) {
                buttonParams = req.body.buttonParams;
                console.log('Found buttonParams (camelCase) directly in request');
            } else if (req.body.params && req.body.params.buttonParams) {
                buttonParams = req.body.params.buttonParams;
                console.log('Found buttonParams in request.params');
            }
        }

        // Validate that we have button layout to work with
        if (!buttonLayout) {
            console.error('No valid button layout found in request');
            return res.status(400).json({
                error: 'Missing button layout information. Please provide button_layout or buttonLayout.',
                requestBody: req.body,
                tip: "Your request should include button layout data either in design.params.buttonLayout, design.button_layout, or directly in the request body."
            });
        }

        // Log the button layout and params we're going to use
        console.log('Using buttonLayout:', buttonLayout);
        console.log('Using buttonParams:', buttonParams || 'Default params will be used');

        // Generate unique ID for this conversion
        const uniqueID = crypto.randomBytes(8).toString('hex');
        const stlFile = path.join(tempDir, `${uniqueID}.stl`);
        const logFile = path.join(tempDir, `${uniqueID}.log`);

        // Add files to cleanup list
        tempFiles.push(stlFile, logFile);

        // Path to the existing SCAD files
        const inputDeviceScad = path.join(__dirname, 'input_device.scad');
        const parametricButtonScad = path.join(__dirname, 'ParametricButton.scad');

        // Check if the necessary SCAD files exist
        if (!fs.existsSync(inputDeviceScad) || !fs.existsSync(parametricButtonScad)) {
            console.error(`Missing SCAD files. inputDeviceScad exists: ${fs.existsSync(inputDeviceScad)}, parametricButtonScad exists: ${fs.existsSync(parametricButtonScad)}`);
            return res.status(500).send('Required SCAD files not found');
        }

        // Format arrays for OpenSCAD
        function formatArrayForOpenSCAD(arr) {
            if (Array.isArray(arr)) {
                return `[${arr.map(item => {
                    if (Array.isArray(item)) {
                        return formatArrayForOpenSCAD(item);
                    } else if (typeof item === 'string') {
                        return `"${item}"`;
                    } else {
                        return item;
                    }
                }).join(',')}]`;
            }
            return arr;
        }

        // Execute OpenSCAD to convert to STL
        try {
            console.log(`Starting OpenSCAD conversion for design ${designId || 'unknown'}`);

            // Create an intermediate SCAD file to avoid command line escaping issues
            const tempScadFile = path.join(tempDir, `${uniqueID}_input.scad`);
            tempFiles.push(tempScadFile);

            // Format the SCAD content
            const scadContent = `
include <${inputDeviceScad.replace(/\\/g, '/')}>
include <${parametricButtonScad.replace(/\\/g, '/')}>

// Button layout configuration
ThreexLayout = ${formatArrayForOpenSCAD(buttonLayout)};

// Button parameters
button_params = ${formatArrayForOpenSCAD(buttonParams || [])};

// Visualization settings
SHOW_ASSEMBLED = true;
SHOW_BUTTONS = true;
BUTTON_VISUAL_SCALE = 1;
`;

            // Write the content to the file
            await fs.writeFile(tempScadFile, scadContent);
            console.log(`Created temporary SCAD file: ${tempScadFile}`);

            // Use the temp file in the OpenSCAD command
            const openScadCmd = `openscad --debug all -q -o "${stlFile}" "${tempScadFile}"`;
            console.log(`Running command: ${openScadCmd}`);

            await new Promise((resolve, reject) => {
                const process = exec(
                    openScadCmd,
                    {maxBuffer: 10 * 1024 * 1024}, // Increase buffer size to 10MB
                    (error, stdout, stderr) => {
                        // Write any output to the log file
                        fs.writeFileSync(logFile, `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`);

                        if (error) {
                            console.error('OpenSCAD error output:', stderr);
                            reject(error);
                            return;
                        } else {
                            resolve(stdout);
                        }
                    }
                );

                // Set a timeout
                setTimeout(() => {
                    process.kill();
                    reject(new Error('OpenSCAD operation timed out after 3 minutes'));
                }, 600000); // 3 minute timeout
            });

            // Check if STL file was created and has valid content
            if (!fs.existsSync(stlFile)) {
                throw new Error('STL file not created');
            }

            const stats = fs.statSync(stlFile);
            if (stats.size === 0) {
                throw new Error('STL file was created but is empty');
            }

            console.log(`STL file successfully created: ${stlFile} (${stats.size} bytes)`);

            // Send STL file
            const stlContent = await fs.readFile(stlFile);

            // Set filename based on design info
            const filename = designId !== 'unknown' && designId !== 'direct'
                ? `button_device_${designId}.stl`
                : 'button_device.stl';

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(stlContent);

            console.log(`STL file successfully sent to client as ${filename}`);

        } catch (err) {
            console.error('Error executing OpenSCAD:', err);

            // Read log file for details if available
            if (fs.existsSync(logFile)) {
                try {
                    const logContent = fs.readFileSync(logFile, 'utf8');
                    console.error("OpenSCAD log:", logContent);

                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'OpenSCAD conversion failed',
                            details: err.message,
                            log: logContent
                        });
                    }
                } catch (logErr) {
                    console.error("Failed to read log file:", logErr);

                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'OpenSCAD conversion failed',
                            details: err.message
                        });
                    }
                }
            } else {
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'OpenSCAD conversion failed',
                        details: err.message
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error generating STL from design:', err);

        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate STL', details: err.message });
        }
    } finally {
        // Clean up temporary files
        setTimeout(() => {
            tempFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlink(file, err => {
                        if (err) console.error(`Error deleting file ${file}:`, err);
                    });
                }
            });
        }, 1000);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

const prusaSlicerPaths = [
  config.PRUSA_SLICER_PATH, // Read from environment
  'C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe',
  // ...other paths...
].filter(Boolean); // Remove any undefined entries