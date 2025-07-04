// Include the button module
include <ParametricButton.scad>
include <BOSL2/std.scad>
include <BOSL2/transforms.scad>
include <BOSL2/math.scad>

$vpr =([25,0,10]);
$vpt =([0,0,0]);
$vpf =(20);
$vpd =(500);

/* [Main Parameters] */
// Default values - can be overridden by passed parameters
DEFAULT_CASE_WIDTH = 140;
DEFAULT_CASE_DEPTH = 80;
DEFAULT_CASE_HEIGHT = 15;
DEFAULT_WALL_THICKNESS = 2.5;
DEFAULT_CORNER_RADIUS = 2;
DEFAULT_TOP_THICKNESS = 4;
DEFAULT_BUTTON_SIZE = 18;
DEFAULT_EDGE_MARGIN = 15;
DEFAULT_LIP_HEIGHT = 3;
DEFAULT_LIP_CLEARANCE = 0.25;

/* [Visualization] */
// Button scaling (affects only visual size of button in preview)
BUTTON_VISUAL_SCALE = 1;
// Show assembled view
SHOW_ASSEMBLED = false;
// Show button cutouts in top plate
SHOW_CUTOUTS = true;
// Show actual buttons
SHOW_BUTTONS = true;
// Show bottom case
SHOW_BOTTOM = true;
// Show top case
SHOW_TOP = true;
// Gap between top and bottom for assembly visualization
ASSEMBLY_GAP = 10;

// Use either a supplied layout or one of the built-in layout functions
// Button parameters = [x, y, size, size2], leaving size2 empty will use size as the button size
button_layout = [[-19,38,18,0],[0,38,18,0],[19,38,18,0],[38,38,18,0],[-19,19,18,0],[0,19,18,0],[19,19,18,0],[38,19,18,18],[-19,0,18,0],[0,0,18,0],[19,0,18,0],[-19,-19,18,0],[0,-19,18,0],[19,-19,18,0],[38,0,18,18],[-9.5,-38,18,37],[19,-38,18,0]];

//3x3 keyboard layout
ThreexLayout = [
  // Number keys (1-4)
  [-30, 40, "1", 18],
  [-10, 40, "2", 18],
  [10, 40, "3", 18],
  [30, 40, "4", 18],

  // W key (centered above S)
  [-20, 0, "W", 18],

  // A, S, D keys (horizontal row)
  [-40, -20, "A", 18],
  [-20, -20, "S", 18],
  [0, -20, "D", 18],

  // Space bar (centered below S, wider than other keys)
  [0, -50, "SPACE", 18, 80]
];

keyboard_layout = [
  // Function row
  [20, 20, "Esc", 18],   [42, 20, "F1", 18],    [64, 20, "F2", 18],    [86, 20, "F3", 18],
  [118, 20, "F4", 18],   [140, 20, "F5", 18],   [162, 20, "F6", 18],   [184, 20, "F7", 18],
  [206, 20, "F8", 18],   [228, 20, "F9", 18],   [250, 20, "F10", 18],  [272, 20, "F11", 18],
  [294, 20, "F12", 18],

  // Navigation cluster
  [320, 20, "PrtSc", 18], [342, 20, "ScrLk", 18], [364, 20, "Pause", 18],

  // Number row
  [20, 42, "`", 18],     [42, 42, "1", 18],     [64, 42, "2", 18],     [86, 42, "3", 18],
  [108, 42, "4", 18],    [130, 42, "5", 18],    [152, 42, "6", 18],    [174, 42, "7", 18],
  [196, 42, "8", 18],    [218, 42, "9", 18],    [240, 42, "0", 18],    [262, 42, "-", 18],
  [294, 42, "Backspace", 18, 28],

  // Navigation cluster
  [320, 42, "Ins", 18],   [342, 42, "Home", 18], [364, 42, "PgUp", 18],

  // Top letter row
  [23, 64, "Tab", 18],   [45, 64, "Q", 18],     [67, 64, "W", 18],     [89, 64, "E", 18],
  [111, 64, "R", 18],    [133, 64, "T", 18],    [155, 64, "Y", 18],    [177, 64, "U", 18],
  [199, 64, "I", 18],    [221, 64, "O", 18],    [243, 64, "P", 18],    [265, 64, "[", 18],
  [294, 64, "\\", 18, 28],

  // Navigation cluster
  [320, 64, "Del", 18],   [342, 64, "End", 18],  [364, 64, "PgDn", 18],

  // Home row
  [27, 86, "Caps", 18, 28], [59, 86, "A", 18],    [81, 86, "S", 18],     [103, 86, "D", 18],
  [125, 86, "F", 18],      [147, 86, "G", 18],    [169, 86, "H", 18],    [191, 86, "J", 18],
  [213, 86, "K", 18],      [235, 86, "L", 18],    [257, 86, ";", 18],    [288, 86, "Enter", 18, 36],

  // Bottom letter row
  [32, 108, "Shift", 18, 36], [72, 108, "Z", 18],    [94, 108, "X", 18],     [116, 108, "C", 18],
  [138, 108, "V", 18],        [160, 108, "B", 18],   [182, 108, "N", 18],    [204, 108, "M", 18],
  [226, 108, ",", 18],        [248, 108, ".", 18],   [280, 108, "Shift", 18, 44],

  // Arrow up key
  [342, 108, "↑", 18],

  // Bottom row
  [32, 130, "Ctrl", 18, 26],  [62, 130, "Win", 18, 26],  [92, 130, "Alt", 18, 26],
  [166, 130, "Space", 18, 112],
  [246, 130, "Alt", 18, 26],  [276, 130, "Ctrl", 18, 26],

  // Arrow keys
  [320, 130, "←", 18],        [342, 130, "↓", 18],       [364, 130, "→", 18],
];

// Customize parameters as needed
// Format: [case_width, case_depth, wall_thickness, corner_radius, top_thickness, button_size, edge_margin, lip_height, lip_clearance, case_height]
// Use 0 for case_width and case_depth to auto-size

button_params =
[
    0, //case_width
    0, //case_depth
    2.5, //wall_thickness
    2, //corner_radius
    2, //top_thickness
    18, //button_size
    8, //edge_margin
    2, //lip_height
    0.1, //lip_clearance
    6 //case_height
];

/* [Hidden] */
$fn = 32;

// Calculate case dimensions based on button layout
function get_case_dimensions(layout, button_size, margin) =
    let(
        // Extract x and y from layout
        layout_coords = [for (btn = layout)
                          [btn[0], btn[1], btn[2]]],
        // Calculate extents
        layout_max_x = max([for (coord = layout_coords) coord[0] +
                        (len(coord) > 2 ? coord[2] : button_size)/2]),
        layout_min_x = min([for (coord = layout_coords) coord[0] -
                        (len(coord) > 2 ? coord[2] : button_size)/2]),
        layout_max_y = max([for (coord = layout_coords) coord[1] +
                        (len(coord) > 2 ? coord[2] : button_size)/2]),
        layout_min_y = min([for (coord = layout_coords) coord[1] -
                        (len(coord) > 2 ? coord[2] : button_size)/2]),
        // Add margin and calculate final size
        width = (layout_max_x - layout_min_x) + margin,
        depth = (layout_max_y - layout_min_y) + margin
    )
    [width, depth];

// Calculate case center offset based on button layout
function get_center_offset(layout, button_size) =
    let(
        // Extract x and y from layout
        layout_coords = [for (btn = layout)
                        [btn[0], btn[1]]],
        // Calculate extents
        layout_max_x = max([for (coord = layout_coords) coord[0] +
                        (len(coord) > 2 ? coord[2] : button_size)/2]),
        layout_min_x = min([for (coord = layout_coords) coord[0] -
                        (len(coord) > 2 ? coord[2] : button_size)/2]),
        layout_max_y = max([for (coord = layout_coords) coord[1] +
                        (len(coord) > 2 ? coord[2] : button_size)/2]),
        layout_min_y = min([for (coord = layout_coords) coord[1] -
                        (len(coord) > 2 ? coord[2] : button_size)/2]),
        // Calculate center
        center_x = (layout_max_x + layout_min_x) / 2,
        center_y = (layout_max_y + layout_min_y) / 2
    )
    [center_x, center_y];

// Button layout visualization
module place_buttons(layout, btn_size, top_thickness, case_height, case_width, case_depth, show_outlines=false) {
    offset = get_center_offset(layout, btn_size);
    for (btn = layout) {
        x = btn[0] - offset[0];
        y = btn[1] - offset[1];
        letter = len(btn) > 2 ? btn[2] : "";
        echo("Button: ", letter, " at (", x, ", ", y, ")");
        size = len(btn) > 3 ? btn[3] : btn_size;
        size2 = len(btn) > 4 ? btn[4] : 0;

        translate([x, y, 0]) {
            if (!SHOW_ASSEMBLED) {
                // Actual button
                scale([BUTTON_VISUAL_SCALE, BUTTON_VISUAL_SCALE, 1])
                color("lightgray") create_button(size, top_thickness);
            }

            if (SHOW_ASSEMBLED) {
                create_keycap(size, size2, top_thickness,
                                            case_height, 0, 0, top_thickness + 2, letter);
            } else {
                create_keycap(size, size2, top_thickness,
                                            case_height, case_width, case_depth, 0, letter);
            }
        }
    }
}

// Top plate with button cutouts
module top_plate(layout, params=[]) {
    // Extract parameters with defaults
    case_width = params[0];
    case_depth = params[1];
    wall_thickness = params[2];
    corner_radius = params[3];
    top_thickness = params[4];
    button_size = params[5];
    edge_margin = params[6];
    lip_height = params[7];
    lip_clearance = params[8];

    offset = get_center_offset(layout, button_size);

    difference() {
        // Solid shape
        cuboid([case_width, case_depth, top_thickness],
                rounding=corner_radius, except=TOP, anchor=BOTTOM);

        // Button cutouts
        if (SHOW_CUTOUTS) {
            for (btn = layout) {
                x = btn[0] - offset[0];
                y = btn[1] - offset[1];
                size = len(btn) > 2 ? btn[2] : button_size;

                translate([x, y, 0])
                cylinder(h=top_thickness+0.2, d=size);
            }
        }
    }


    // Add lip for better fit
    lip_width = case_width - 2 * (wall_thickness + lip_clearance);
    lip_depth = case_depth - 2 * (wall_thickness + lip_clearance);

    up(lip_height/2+top_thickness/2) {
        difference() {
            cuboid([lip_width, lip_depth, lip_height],
                    rounding=corner_radius, edges="Z", anchor=BOTTOM);

            // Cut any overlapping holes
            for (btn = layout) {
                x = btn[0] - offset[0];
                y = btn[1] - offset[1];
                size = len(btn) > 2 ? btn[2] : button_size;

                translate([x, y, -0.1])
                cylinder(h=lip_height+0.2, d=size);
            }

        }
    }
}

// Bottom case
module bottom_case(layout, params=[]) {
    // Extract parameters
    case_width = params[0];
    case_depth = params[1];
    wall_thickness = params[2];
    corner_radius = params[3];
    button_size = params[5];
    lip_height = params[7];
    case_height = params[9];

    offset = get_center_offset(layout, button_size);

    // Outer shell
    difference() {
        // Solid case
        cuboid([case_width, case_depth, case_height],
                rounding=corner_radius, except=TOP, anchor=BOTTOM);

        // Inner cutout
        translate([0, 0, wall_thickness])
        cuboid([case_width - 2*wall_thickness,
                case_depth - 2*wall_thickness,
                case_height],
                rounding=corner_radius, except=BOTTOM, anchor=BOTTOM);

        // Button cutouts

        if (SHOW_CUTOUTS) {
            for (btn = layout) {
                x = btn[0] - offset[0];
                y = btn[1] - offset[1];
                size = len(btn) > 2 ? btn[2] : button_size;

                translate([x, y, 0])
                cylinder(h=wall_thickness+0.2, d=size);
            }

    }

    //Create touchpoints

    if(!SHOW_ASSEMBLED) {
        for (btn = layout) {
            x = btn[0] - offset[0];
            y = btn[1] - offset[1];
            size = len(btn) > 2 ? btn[2] : button_size;

            translate([x, y, 0])
            color("black") cylinder(h=wall_thickness, d=size);
        }
    }
}
}

module wires (layout, case_width, button_size, top_thickness) {
    //Every unique y value
    list = [0, 22, 44];
    //list = [20, 42, 64, 86, 108, 130];
    offset = get_center_offset(layout, button_size);
    //wire_offset = ((button_size/2)-(button_size*0.04));
    wire_offset = button_size*0.08;

    for (y = list) {
        translate([0, y - offset[1] + wire_offset , 0])
        color("black") cuboid([case_width, top_thickness, top_thickness+0.5], anchor=BOTTOM);

        translate([0, y - offset[1] - wire_offset , 0])
        color("black") cuboid([case_width, top_thickness, top_thickness+0.5], anchor=BOTTOM);
    }
}

// Main assembly - uses a parameter list
// params = [
//   0: case_width,      1: case_depth,    2: wall_thickness,
//   3: corner_radius,   4: top_thickness, 5: button_size,
//   6: edge_margin,     7: lip_height,    8: lip_clearance,
//   9: case_height
// ]
module input_device(layout, params=[]) {
    // Extract parameters with defaults
    case_width = (params != [] && params[0] != undef) ? params[0] : DEFAULT_CASE_WIDTH;
    case_depth = (params != [] && params[1] != undef) ? params[1] : DEFAULT_CASE_DEPTH;
    wall_thickness = (params != [] && params[2] != undef) ? params[2] : DEFAULT_WALL_THICKNESS;
    corner_radius = (params != [] && params[3] != undef) ? params[3] : DEFAULT_CORNER_RADIUS;
    top_thickness = (params != [] && params[4] != undef) ? params[4] : DEFAULT_TOP_THICKNESS;
    button_size = (params != [] && params[5] != undef) ? params[5] : DEFAULT_BUTTON_SIZE;
    edge_margin = (params != [] && params[6] != undef) ? params[6] : DEFAULT_EDGE_MARGIN;
    lip_height = (params != [] && params[7] != undef) ? params[7] : DEFAULT_LIP_HEIGHT;
    lip_clearance = (params != [] && params[8] != undef) ? params[8] : DEFAULT_LIP_CLEARANCE;
    case_height = (params != [] && params[9] != undef) ? params[9] : DEFAULT_CASE_HEIGHT;

    // Calculate dimensions from layout if needed
    auto_size = (case_width == 0 || case_depth == 0);
    case_dims = auto_size ?
                get_case_dimensions(layout, button_size, edge_margin) :
                [case_width, case_depth];

    parameters = [case_dims[0], case_dims[1], wall_thickness, corner_radius,
                  top_thickness, button_size, edge_margin, lip_height,
                  lip_clearance, case_height];

    if (SHOW_TOP) {
        // mirror([0,1,0])  // Removed this again because was fucked and added it to the text part..
        if (SHOW_ASSEMBLED) {
            up(case_height+top_thickness)
            rotate([0,180,180])
            {
                difference() {
                        union() {
                        // Show top plate with cutouts
                        top_plate(layout, parameters);
                        // Show buttons
                        place_buttons(layout, button_size, top_thickness, case_height-wall_thickness, case_dims[0], case_dims[1]);
                        }
                }


            }
        } else {
            // Show top separated for better visibility
            mirror([1,0,0])
            right(case_dims[0]+ASSEMBLY_GAP) {
                    // Show top plate with cutouts
                    top_plate(layout, parameters);
                    // Show buttons
                    place_buttons(layout, button_size, top_thickness, case_height-wall_thickness, case_dims[0], case_dims[1]);


            }
        }
    }
    if (SHOW_BOTTOM) {
        difference() {
                bottom_case(layout, parameters);
                //wires(layout, case_dims[0], button_size, top_thickness);
            }
            //wires(layout, case_dims[0], button_size, wall_thickness);
    }
}

// Create the input device
//input_device(button_layout, button_params);
//input_device(keyboard_layout, button_params);
input_device(ThreexLayout, button_params);