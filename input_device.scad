// Include the button module
include <ParametricButton.scad>
include <BOSL2/std.scad>
include <BOSL2/transforms.scad>
include <BOSL2/math.scad>

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
SHOW_BOTTOM = false;
// Show top case
SHOW_TOP = true;
// Gap between top and bottom for assembly visualization
ASSEMBLY_GAP = 10;

// Use either a supplied layout or one of the built-in layout functions
button_layout = [
    // W key (centered above S)
    [0, 19, 18],
    
    // A, S, D keys (horizontal row)
    [-19, 0, 18],  // A key
    [0, 0, 18],    // S key
    [19, 0, 18]   // D key
    
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
    2, //button_size
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
module place_buttons(layout, btn_size, top_thickness, case_height, case_width, show_outlines=false) {
    offset = get_center_offset(layout, btn_size);
    for (btn = layout) {
        x = btn[0] - offset[0];
        y = btn[1] - offset[1]; 
        size = len(btn) > 2 ? btn[2] : btn_size;
        
        translate([x, y, 0]) {
            if (SHOW_BUTTONS) {
                // Actual button
                scale([BUTTON_VISUAL_SCALE, BUTTON_VISUAL_SCALE, 1])
                color("lightgray") create_button(size, top_thickness, case_height, case_width);
            }
            
            if (show_outlines) {
                // Outline for debugging
                cylinder(h=0.1, d=size);
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
        // Main plate
        difference() {
            // Solid shape
            cuboid([case_width, case_depth, top_thickness], 
                    rounding=corner_radius, edges="Z", anchor=BOTTOM);
            
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
    }

    //Create touchpoints
    for (btn = layout) {
        x = btn[0] - offset[0];
        y = btn[1] - offset[1];
        size = len(btn) > 2 ? btn[2] : button_size;
        
        translate([x, y, 0])
        color("black") cylinder(h=wall_thickness, d=size);
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
        if (SHOW_ASSEMBLED) {
            up(case_height+top_thickness)
            rotate([0,180,0])
            {
                top_plate(layout, parameters);
                place_buttons(layout, button_size, top_thickness, case_height-wall_thickness, case_dims[0]);
            }
        } else {
            // Show top separated for better visibility
            right(case_dims[0]+ASSEMBLY_GAP) {
                top_plate(layout, parameters);
                place_buttons(layout, button_size, top_thickness, case_height-wall_thickness, case_dims[0]);
            }
        }
    }
    if (SHOW_BOTTOM) {
        bottom_case(layout, parameters);
    }
}

// Create the input device
input_device(button_layout, button_params);