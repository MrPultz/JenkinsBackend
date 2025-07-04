### Jenkins backend - Installation Guide

### Prerequisites
* Node.js 18 or higher
* Git
* Windows/Linux operating system
* Administrative privileges for software installation

### Backend Dependencies
### 1. OpenSCAD Installation


#### Windows:
1. Download OpenSCAD from https://openscad.org/downloads.html
2. Install the Windows version (typically OpenSCAD-2023.12.23-x86_64-Installer.exe)
3. During installation, ensure "Add to PATH" is selected
4. Verify installation by opening Command Prompt and running:
```bash
openscad --version
```

#### Linux (Ubunto/Debian):
```bash
sudo apt-get update
sudo apt-get install openscad
```

#### Linux (CentOS/RHel):
```bash
sudo yum install openscad
```

### 2. 3D Printing Slicing tools of your choice
This will be an example with PrusaSlicer

#### Windows:
1. Download PrusaSlicer from https://www.prusa3d.com/page/prusaslicer_424/
2. Install the Windows version
3. The installer typically places PrusaSlicer in:
 * C:\Program Files\Prusa3D\PrusaSlicer\
 * C:\Program Files (x86)\Prusa3D\PrusaSlicer\
4. Verify installation by running:
```bash
"C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe" --version
```

#### Linux
1. Download the Linux AppImage from the Prusa website
2. Extract to /opt/ directory:
```bash
sudo tar -xjf PrusaSlicer-*.tar.bz2 -C /opt
sudo ln -s /opt/PrusaSlicer-*/bin/prusa-slicer /usr/local/bin/prusa-slicer
```

### Project Setup
1. Clone the Repository
```bash
git clone https://github.com/MrPultz/JenkinsBackend/
cd JenkinsBackend
```
2. Install Node.js Dependencies
```bash
npm install
```

3. Environment Configuration
1. Copy the example enironment file:
```bash
cp .env.example .env
```
2. Edit the .env file with your configuration:
```bash
PORT=3000
CORS_ORIGIN=http://localhost:4200
TMP_FILE_RETENTION_MS=3600000
PRUSA_CONNECT_API_TOKEN=your_token_here
```

3. Optional: Set PrusaSlicer path if not in default location:
```bash
PRUSA_SLICER_PATH=C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe
```

4. Create Required Directories
The application will automatically create these, but if not make them manually:
```bash
mkdir temp
mkdir assets
```

5. BOSL2 Library Setup
The project uses the BOSL2 OpenSCAD library. You need to install it:

Method 1: Download and Place Manually

1. Download BOSL2 from https://github.com/revarbat/BOSL2
2. Extract the BOSL2 folder to your OpenSCAD libraries directory:
 * Windows: %USERPROFILE%\Documents\OpenSCAD\libraries\
 * Linux: ~/.local/share/OpenSCAD/libraries/

Methid 2: Git Clone (Recommended)
```bash
# Windows
cd "%USERPROFILE%\Documents\OpenSCAD\libraries"
git clone https://github.com/revarbat/BOSL2.git

# Linux
cd ~/.local/share/OpenSCAD/libraries
git clone https://github.com/revarbat/BOSL2.git
```

### Testing the Installation
1. Test OpenSCAD
```bash
openscad --version
```

Expected output: Version information for OpenSCAD

2. Test PrusaSlicer
```bash
# Windows
"C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe" --version

# Linux
prusa-slicer --version
```

3. Start the Backend server
```bash
npm start
# or
node server.js
```

Expected Output:
PrusaSlicer config initialized
Server listening on port 3000
