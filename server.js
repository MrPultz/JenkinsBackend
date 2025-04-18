const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const multer = require('multer');
const config = require('./config-helper');

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

// Endpoint to convert stl to G-code using PrusaSlicer
app.post('/api/convert-stl-to-gcode', upload.single('stlFile'), async (req, res) => {
    try {
        const stlFilePath = req.file?.path;

        if(!stlFilePath) {
            return res.status(400).json({ error: 'STL file is required' });
        }

        // Get printer type and other settings from request
        const printerType = req.body.printerType || 'ORIGINAL_PRUSA_MK4'; // Default to Prusa MK4
        const filementType = req.body.filementType || 'Prusament PLA'; // Default to PLA
        const qualityPorfile = req.body.qualityPorfile || '0.15mm SPEED'; // Default to 0.15mm SPEED

        // Generate unique ID for the conversion
        const uniqueID = crypto.randomBytes(8).toString('hex');
        const gcodeFile = path.join(tempDir, `${uniqueID}.gcode`);

        // Execute PrusaSlicer to convert STL to G-code using the config helper
        try {
            const sliceCommand = config.getSliceCommand(stlFilePath, gcodeFile, printerType, filementType, qualityPorfile);

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
            if(!fs.existsSync(gcodeFile)) {
                throw new Error('G-code file not created');
            }

            // Send G-code file
            const gcodeContent = await fs.readFile(gcodeFile);

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="model.gcode"');
            res.send(gcodeContent);

            // Clean up files after sending response
            setTimeout(() => {
                fs.unlink(stlFilePath, err => {
                    if(err) return console.error('Error deleting STL file:', err);
                });
                fs.unlink(gcodeFile, err => {
                    if(err) return console.error('Error deleting G-code file:', err);
                });
            }, 1000);
        } catch(err) {
            console.error('Error converting STL to G-code:', err);
            res.status(500).json({ error: 'Conversion failed', details: err.message });
        }
    } catch(err) {
        console.error('Error converting STL to G-code:', err);
        res.status(500).json({ error: 'Conversion failed', details: err.message });
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

        // Create a new SCAD file that imports the existing files and passes the button layout and params
        let scadContent = `
include <${inputDeviceScad.replace(/\\/g, '/')}>
include <${parametricButtonScad.replace(/\\/g, '/')}>

// Button layout configuration
button_layout=${JSON.stringify(buttonLayout)};
`;

        // Add button_params if provided
        if (buttonParams) {
            scadContent += `
// Button parameters
button_params=${JSON.stringify(buttonParams)};
`;
        }

        // Call main function
        scadContent += `
// Call main function or module from your files
main_assembly();
`;

        // Write the combined SCAD code to file
        await fs.writeFile(outputScadFile, scadContent);

        console.log(`Combined SCAD file created at ${outputScadFile}`);
        console.log(`SCAD content: ${scadContent}`);

        // Execute OpenSCAD to convert SCAD to STL with output to log file
        try {
            console.log(`Starting OpenSCAD conversion of ${outputScadFile} to ${stlFile}`);

            // Use --debug all flag to get more verbose output
            const openScadCmd = `openscad --debug all -o "${stlFile}" "${outputScadFile}"`;
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
                }, 180000); // 3 minute timeout
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

// Start server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});