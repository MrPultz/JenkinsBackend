include <BOSL2/std.scad>

// Default diameter - used when no parameter is provided
default_button_diameter = 18;
default_outer_ring_height = 3.5; 
default_case_height = 0;
// Fixed mechanical parameters
bend_height = 0.725; // Keep fixed for mechanical properties
bridge_base_width = 1.5; // Base width that could be scaled
ring_width_ratio = 0.08; // 8% of diameter for outer and middle rings
ring_spacing = 0.02; // 3% of diameter for spacing between rings

$fn=32; // Set the number of facets for smoothness

module create_button(diameter = default_button_diameter, outer_ring_height = default_outer_ring_height) {
    // Derived parameters based on input diameter
    button_radius = diameter / 2;
    
    // Ring parameters
    outer_ring_d = diameter * ring_width_ratio; // 8% of diameter
    middle_ring_offset = outer_ring_d + (diameter * ring_spacing); // 2% spacing
    middle_ring_d = diameter * ring_width_ratio; // 8% of diameter
    inner_ring_offset = middle_ring_offset + middle_ring_d + (diameter * ring_spacing); // 2% spacing

    // Bridge parameters
    bridge_width = bridge_base_width; // Could optionally scale with diameter using: diameter * 0.083
    bridge_height = diameter * 0.16;

    union() {
        create_rings(button_radius, outer_ring_d, middle_ring_offset, 
                    middle_ring_d, inner_ring_offset, outer_ring_height, 
                    bend_height);
        
        // Calculate bridge positions based on ring positions
        // West bridge - spans from outer ring to middle ring
        translate([-(button_radius - inner_ring_offset), 0, bend_height/2]) 
            cube([bridge_width, bridge_height, bend_height], center = true);

        // East bridge - spans from middle ring to inner ring
        translate([button_radius - inner_ring_offset, 0, bend_height/2]) 
            cube([bridge_width, bridge_height, bend_height], center = true);
        
        // North bridge - spans across all rings
        translate([0, -(button_radius - inner_ring_offset/2), bend_height/2]) 
            cube([bridge_height, bridge_width, bend_height], center = true);
        
        // South bridge - spans across all rings
        translate([0, button_radius - inner_ring_offset/2, bend_height/2]) 
            cube([bridge_height, bridge_width, bend_height], center = true);
    }
  
}   

module create_rings(r, outer_thickness, middle_offset, middle_thickness, 
                   inner_offset, outer_height, cross_w, cross_h, bend_h) {
    // Create outer ring
    difference() {
        cylinder(h=outer_height, r=r);
        cylinder(h=outer_height, r=r-outer_thickness);
    }
    // Create middle ring    
    difference() {
        cylinder(h=bend_height, r=r-middle_offset);
        cylinder(h=bend_height, r=r-middle_offset-middle_thickness);
    }
    // Create Inner ring with cross  
    difference() {   
        cylinder(h=bend_height, r=r-inner_offset);
        cylinder(h=bend_height, r=r*0.4); // Inner hole for cross
    }
}

module create_keycap(size1, size2, outer_height, case_height, x_offset, y_offset, z_offset) {
    // Ring parameters
    outer_ring_d = size1 * ring_width_ratio; // 8% of diameter
    middle_ring_offset = outer_ring_d + (size1 * ring_spacing); // 2% spacing
    middle_ring_d = size1 * ring_width_ratio; // 8% of diameter
    inner_offset = middle_ring_offset + middle_ring_d + (size1 * ring_spacing); // 2% spacing
    letter = ""; // Default letter to be engraved

    // Create the keycap with the specified diameter and outer ring height
    translate([x_offset, y_offset, -z_offset])
    difference() {
        union() {
        if(size2 == 0){cylinder(d=size1, h=1);}
        else{cuboid([size2, size1, 1], rounding=1, edges="Z", anchor=BOTTOM);}
            cylinder(d=size1-inner_offset, h=outer_height+2);
            translate([0, 0, outer_height+2])
            cylinder(d=size1*0.4, h=case_height+1);
        }

        // Add letter if provided
        if (letter != "") {
            echo("Adding letter: ", letter);
            linear_extrude(2)
            text(text=letter, size=5, halign="center", valign="center", font="Liberation Sans:style=Bold");
        }
    }
}   

//create_button(diameter = 18, outer_ring_height = 3.5, x_offset = 20); // Example usage with default parameters