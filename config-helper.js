// config-helper.js
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

// Directory for PrusaSlicer config
const configDir = path.join(__dirname, 'prusaslicer-config');

// Ensure config directory exists
fs.ensureDirSync(configDir);

// Initialize default PrusaSlicer configs
async function initializePrusaSlicerConfig() {
  // Create necessary directories
  fs.ensureDirSync(path.join(configDir, 'printer'));
  fs.ensureDirSync(path.join(configDir, 'filament'));
  fs.ensureDirSync(path.join(configDir, 'print'));

  // Check if config is already initialized with profiles
  const printerFiles = fs.readdirSync(path.join(configDir, 'printer'));
  if (printerFiles.length > 0) {
    console.log('PrusaSlicer config already initialized');
    return;
  }

  console.log('Initializing PrusaSlicer config...');

  // Create default profiles

  // Create a basic printer profile
  const basicPrinterConfig = `
[printer_settings]
name = Original Prusa MK4
bed_shape = 0x0,250x0,250x210,0x210
max_print_height = 220
nozzle_diameter = 0.4
  `;

  fs.writeFileSync(path.join(configDir, 'printer', 'ORIGINAL_PRUSA_MK4.ini'), basicPrinterConfig);

  // Create a basic filament profile
  const basicFilamentConfig = `
[filament_settings]
name = Prusament PLA
temperature = 215
bed_temperature = 60
  `;

  fs.writeFileSync(path.join(configDir, 'filament', 'Prusament PLA.ini'), basicFilamentConfig);

  // Create a basic print profile
  const basicPrintConfig = `
[print_settings]
name = 0.15mm SPEED
layer_height = 0.15
perimeters = 3
top_solid_layers = 5
bottom_solid_layers = 5
fill_density = 15%
  `;

  fs.writeFileSync(path.join(configDir, 'print', '0.15mm SPEED.ini'), basicPrintConfig);

  console.log('PrusaSlicer config initialized successfully with default profiles');
}

// Function to get available printer profiles
function getPrinterProfiles() {
  const printerDir = path.join(configDir, 'printer');
  if (!fs.existsSync(printerDir)) {
    return [];
  }

  const printerFiles = fs.readdirSync(printerDir)
    .filter(file => file.endsWith('.ini'))
    .map(file => {
      const id = path.basename(file, '.ini');
      const content = fs.readFileSync(path.join(printerDir, file), 'utf8');
      const nameMatch = content.match(/name\s*=\s*([^\n]+)/);
      const name = nameMatch ? nameMatch[1].trim() : id;
      return { id, name };
    });

  return printerFiles;
}

// Function to get available filament profiles
function getFilamentProfiles() {
  const filamentDir = path.join(configDir, 'filament');
  if (!fs.existsSync(filamentDir)) {
    return [];
  }

  const filamentFiles = fs.readdirSync(filamentDir)
    .filter(file => file.endsWith('.ini'))
    .map(file => {
      const id = path.basename(file, '.ini');
      const content = fs.readFileSync(path.join(filamentDir, file), 'utf8');
      const nameMatch = content.match(/name\s*=\s*([^\n]+)/);
      const name = nameMatch ? nameMatch[1].trim() : id;
      return { id, name };
    });

  return filamentFiles;
}

// Function to get available print profiles
function getPrintProfiles() {
  const printDir = path.join(configDir, 'print');
  if (!fs.existsSync(printDir)) {
    return [];
  }

  const printFiles = fs.readdirSync(printDir)
    .filter(file => file.endsWith('.ini'))
    .map(file => {
      const id = path.basename(file, '.ini');
      const content = fs.readFileSync(path.join(printDir, file), 'utf8');
      const nameMatch = content.match(/name\s*=\s*([^\n]+)/);
      const name = nameMatch ? nameMatch[1].trim() : id;
      return { id, name };
    });

  return printFiles;
}

// Function to get the command for slicing with specific profiles
function getSliceCommand(stlFilePath, gcodeFilePath, printerProfile, filamentProfile, printProfile) {
  const printerIniPath = path.join(configDir, 'printer', `${printerProfile}.ini`);
  const filamentIniPath = path.join(configDir, 'filament', `${filamentProfile}.ini`);
  const printIniPath = path.join(configDir, 'print', `${printProfile}.ini`);

  // Define paths to try for PrusaSlicer
  const prusaSlicerPaths = [
    'C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe',
    'C:\\Program Files\\PrusaSlicer\\prusa-slicer-console.exe',
    'C:\\Program Files (x86)\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe',
    // If console version not found, try the GUI version
    'C:\\Program Files\\Prusa3D\\PrusaSlicer\\PrusaSlicer.exe',
    'C:\\Program Files\\PrusaSlicer\\PrusaSlicer.exe',
    'C:\\Program Files (x86)\\Prusa3D\\PrusaSlicer\\PrusaSlicer.exe',
    // Try the command directly as a last resort
    'prusa-slicer-console'
  ];

  // Use the first path that exists, or default to the last one
  let prusaSlicerPath = prusaSlicerPaths[prusaSlicerPaths.length - 1];
  for (const testPath of prusaSlicerPaths) {
    if (fs.existsSync(testPath)) {
      prusaSlicerPath = testPath;
      break;
    }
  }

  console.log(`Using PrusaSlicer at: ${prusaSlicerPath}`);

  return `"${prusaSlicerPath}" --datadir "${configDir}" --export-gcode --load "${printerIniPath}" --load "${filamentIniPath}" --load "${printIniPath}" --output "${gcodeFilePath}" "${stlFilePath}"`;
}

module.exports = {
  initializePrusaSlicerConfig,
  getPrinterProfiles,
  getFilamentProfiles,
  getPrintProfiles,
  getSliceCommand
};