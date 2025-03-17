// Base keyboard dimensions
keyboard_width = 450;
keyboard_height = 150;
keyboard_thickness = 10;
corner_radius = 5;

// Standard key dimensions and spacing
standard_key_width = 19;
standard_key_height = 19;
key_thickness = 5;
key_spacing = 0;
key_corner_radius = 2;

// Colors
base_color = [0.2, 0.2, 0.25];
standard_key_color = [0.85, 0.85, 0.85];
modifier_key_color = [0.75, 0.75, 0.8];
function_key_color = [0.7, 0.7, 0.85];
space_key_color = [0.8, 0.8, 0.85];
arrow_key_color = [0.7, 0.8, 0.75];
numpad_key_color = [0.8, 0.8, 0.7];

// Create a rounded cube
module rounded_cube(width, height, depth, radius) {
    hull() {
        translate([radius, radius, radius])
        sphere(r = radius, $fn = 30);
        
        translate([width - radius, radius, radius])
        sphere(r = radius, $fn = 30);
        
        translate([radius, height - radius, radius])
        sphere(r = radius, $fn = 30);
        
        translate([width - radius, height - radius, radius])
        sphere(r = radius, $fn = 30);
        
        translate([radius, radius, depth - radius])
        sphere(r = radius, $fn = 30);
        
        translate([width - radius, radius, depth - radius])
        sphere(r = radius, $fn = 30);
        
        translate([radius, height - radius, depth - radius])
        sphere(r = radius, $fn = 30);
        
        translate([width - radius, height - radius, depth - radius])
        sphere(r = radius, $fn = 30);
    }
}

// Create a single key with rounded corners and label
module key(width, height, color_val) {
    color(color_val)
    rounded_cube(width, height, key_thickness, key_corner_radius);
    
    // Key stem
    color([0.6, 0.6, 0.6])
    translate([width/2 - 2, height/2 - 2, -2])
    cube([4, 4, 2]);
}

// Create the keyboard base with rounded corners
module keyboard_base() {
    color(base_color)
    rounded_cube(keyboard_width, keyboard_height, keyboard_thickness, corner_radius);
}

// Create the keyboard with varied key sizes
module keyboard() {
    // Render the base
    keyboard_base();
    
    // Function Row
    key_pos(0, 0, standard_key_width, standard_key_height, function_key_color); // Esc
    key_pos(38, 0, standard_key_width, standard_key_height, function_key_color); // F1
    key_pos(57, 0, standard_key_width, standard_key_height, function_key_color); // F2
    key_pos(76, 0, standard_key_width, standard_key_height, function_key_color); // F3
    key_pos(95, 0, standard_key_width, standard_key_height, function_key_color); // F4
    key_pos(123.5, 0, standard_key_width, standard_key_height, function_key_color); // F5
    key_pos(142.5, 0, standard_key_width, standard_key_height, function_key_color); // F6
    key_pos(161.5, 0, standard_key_width, standard_key_height, function_key_color); // F7
    key_pos(180.5, 0, standard_key_width, standard_key_height, function_key_color); // F8
    key_pos(209, 0, standard_key_width, standard_key_height, function_key_color); // F9
    key_pos(228, 0, standard_key_width, standard_key_height, function_key_color); // F10
    key_pos(247, 0, standard_key_width, standard_key_height, function_key_color); // F11
    key_pos(266, 0, standard_key_width, standard_key_height, function_key_color); // F12
    key_pos(294.5, 0, standard_key_width, standard_key_height, function_key_color); // Print Screen
    key_pos(313.5, 0, standard_key_width, standard_key_height, function_key_color); // Scroll Lock
    key_pos(332.5, 0, standard_key_width, standard_key_height, function_key_color); // Pause
    
    // Number Row
    key_pos(0, 38, standard_key_width, standard_key_height, standard_key_color); // `
    key_pos(19, 38, standard_key_width, standard_key_height, standard_key_color); // 1
    key_pos(38, 38, standard_key_width, standard_key_height, standard_key_color); // 2
    key_pos(57, 38, standard_key_width, standard_key_height, standard_key_color); // 3
    key_pos(76, 38, standard_key_width, standard_key_height, standard_key_color); // 4
    key_pos(95, 38, standard_key_width, standard_key_height, standard_key_color); // 5
    key_pos(114, 38, standard_key_width, standard_key_height, standard_key_color); // 6
    key_pos(133, 38, standard_key_width, standard_key_height, standard_key_color); // 7
    key_pos(152, 38, standard_key_width, standard_key_height, standard_key_color); // 8
    key_pos(171, 38, standard_key_width, standard_key_height, standard_key_color); // 9
    key_pos(190, 38, standard_key_width, standard_key_height, standard_key_color); // 0
    key_pos(209, 38, standard_key_width, standard_key_height, standard_key_color); // -
    key_pos(228, 38, standard_key_width, standard_key_height, standard_key_color); // =
    key_pos(247, 38, 38, standard_key_height, modifier_key_color); // Backspace
    key_pos(294.5, 38, standard_key_width, standard_key_height, modifier_key_color); // Insert
    key_pos(313.5, 38, standard_key_width, standard_key_height, modifier_key_color); // Home
    key_pos(332.5, 38, standard_key_width, standard_key_height, modifier_key_color); // Page Up
    
    // QWERTY Row
    key_pos(0, 57, 28.5, standard_key_height, modifier_key_color); // Tab
    key_pos(38, 57, standard_key_width, standard_key_height, standard_key_color); // Q
    key_pos(57, 57, standard_key_width, standard_key_height, standard_key_color); // W
    key_pos(76, 57, standard_key_width, standard_key_height, standard_key_color); // E
    key_pos(95, 57, standard_key_width, standard_key_height, standard_key_color); // R
    key_pos(114, 57, standard_key_width, standard_key_height, standard_key_color); // T
    key_pos(133, 57, standard_key_width, standard_key_height, standard_key_color); // Y
    key_pos(152, 57, standard_key_width, standard_key_height, standard_key_color); // U
    key_pos(171, 57, standard_key_width, standard_key_height, standard_key_color); // I
    key_pos(190, 57, standard_key_width, standard_key_height, standard_key_color); // O
    key_pos(209, 57, standard_key_width, standard_key_height, standard_key_color); // P
    key_pos(228, 57, standard_key_width, standard_key_height, standard_key_color); // [
    key_pos(247, 57, standard_key_width, standard_key_height, standard_key_color); // ]
    key_pos(266, 57, 28.5, standard_key_height, standard_key_color); // \
    key_pos(294.5, 57, standard_key_width, standard_key_height, modifier_key_color); // Delete
    key_pos(313.5, 57, standard_key_width, standard_key_height, modifier_key_color); // End
    key_pos(332.5, 57, standard_key_width, standard_key_height, modifier_key_color); // Page Down
    
    // Home Row
    key_pos(0, 76, 32.5, standard_key_height, modifier_key_color); // Caps Lock
    key_pos(38, 76, standard_key_width, standard_key_height, standard_key_color); // A
    key_pos(57, 76, standard_key_width, standard_key_height, standard_key_color); // S
    key_pos(76, 76, standard_key_width, standard_key_height, standard_key_color); // D
    key_pos(95, 76, standard_key_width, standard_key_height, standard_key_color); // F
    key_pos(114, 76, standard_key_width, standard_key_height, standard_key_color); // G
    key_pos(133, 76, standard_key_width, standard_key_height, standard_key_color); // H
    key_pos(152, 76, standard_key_width, standard_key_height, standard_key_color); // J
    key_pos(171, 76, standard_key_width, standard_key_height, standard_key_color); // K
    key_pos(190, 76, standard_key_width, standard_key_height, standard_key_color); // L
    key_pos(209, 76, standard_key_width, standard_key_height, standard_key_color); // ;
    key_pos(228, 76, standard_key_width, standard_key_height, standard_key_color); // '
    key_pos(247, 76, 42.5, standard_key_height, modifier_key_color); // Enter
    
    // Bottom Row
    key_pos(0, 95, 47.5, standard_key_height, modifier_key_color); // Left Shift
    key_pos(57, 95, standard_key_width, standard_key_height, standard_key_color); // Z
    key_pos(76, 95, standard_key_width, standard_key_height, standard_key_color); // X
    key_pos(95, 95, standard_key_width, standard_key_height, standard_key_color); // C
    key_pos(114, 95, standard_key_width, standard_key_height, standard_key_color); // V
    key_pos(133, 95, standard_key_width, standard_key_height, standard_key_color); // B
    key_pos(152, 95, standard_key_width, standard_key_height, standard_key_color); // N
    key_pos(171, 95, standard_key_width, standard_key_height, standard_key_color); // M
    key_pos(190, 95, standard_key_width, standard_key_height, standard_key_color); // ,
    key_pos(209, 95, standard_key_width, standard_key_height, standard_key_color); // .
    key_pos(228, 95, standard_key_width, standard_key_height, standard_key_color); // /
    key_pos(247, 95, 47.5, standard_key_height, modifier_key_color); // Right Shift
    key_pos(313.5, 95, standard_key_width, standard_key_height, arrow_key_color); // Up Arrow
    
    // Bottom-most Row
    key_pos(0, 114, 28.5, standard_key_height, modifier_key_color); // Left Ctrl
    key_pos(38, 114, standard_key_width, standard_key_height, modifier_key_color); // Left Win
    key_pos(57, 114, standard_key_width, standard_key_height, modifier_key_color); // Left Alt
    key_pos(76, 114, 114, standard_key_height, space_key_color); // Space
    key_pos(209, 114, standard_key_width, standard_key_height, modifier_key_color); // Right Alt
    key_pos(228, 114, standard_key_width, standard_key_height, modifier_key_color); // Right Win
    key_pos(247, 114, standard_key_width, standard_key_height, modifier_key_color); // Menu
    key_pos(266, 114, standard_key_width, standard_key_height, modifier_key_color); // Right Ctrl
    key_pos(294.5, 114, standard_key_width, standard_key_height, arrow_key_color); // Left Arrow
    key_pos(313.5, 114, standard_key_width, standard_key_height, arrow_key_color); // Down Arrow
    key_pos(332.5, 114, standard_key_width, standard_key_height, arrow_key_color); // Right Arrow
    
    // Numpad
    key_pos(370, 38, standard_key_width, standard_key_height, numpad_key_color); // Num Lock
    key_pos(389, 38, standard_key_width, standard_key_height, numpad_key_color); // Numpad /
    key_pos(408, 38, standard_key_width, standard_key_height, numpad_key_color); // Numpad *
    key_pos(427, 38, standard_key_width, standard_key_height, numpad_key_color); // Numpad -
    key_pos(370, 57, standard_key_width, standard_key_height, numpad_key_color); // Numpad 7
    key_pos(389, 57, standard_key_width, standard_key_height, numpad_key_color); // Numpad 8
    key_pos(408, 57, standard_key_width, standard_key_height, numpad_key_color); // Numpad 9
    key_pos(427, 57, standard_key_width, 38, numpad_key_color); // Numpad +
    key_pos(370, 76, standard_key_width, standard_key_height, numpad_key_color); // Numpad 4
    key_pos(389, 76, standard_key_width, standard_key_height, numpad_key_color); // Numpad 5
    key_pos(408, 76, standard_key_width, standard_key_height, numpad_key_color); // Numpad 6
    key_pos(370, 95, standard_key_width, standard_key_height, numpad_key_color); // Numpad 1
    key_pos(389, 95, standard_key_width, standard_key_height, numpad_key_color); // Numpad 2
    key_pos(408, 95, standard_key_width, standard_key_height, numpad_key_color); // Numpad 3
    key_pos(427, 95, standard_key_width, 38, numpad_key_color); // Numpad Enter
    key_pos(370, 114, 38, standard_key_height, numpad_key_color); // Numpad 0
    key_pos(408, 114, standard_key_width, standard_key_height, numpad_key_color); // Numpad .
}

// Helper function to position keys
module key_pos(x, y, width, height, color_val) {
    translate([x, y, keyboard_thickness])
    key(width, height, color_val);
}

// Render the keyboard
keyboard();