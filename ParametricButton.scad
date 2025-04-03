// Default diameter - used when no parameter is provided
default_button_diameter = 18;
default_outer_ring_height = 3.5; // Fixed mechanical parameters
// Fixed mechanical parameters
bend_height = 0.725; // Keep fixed for mechanical properties
bridge_base_width = 1.5; // Base width that could be scaled

module create_button(diameter = default_button_diameter, outer_ring_height = default_outer_ring_height) {
    // Derived parameters based on input diameter
    button_radius = diameter / 2;
    
    // Ring parameters
    outer_ring_thickness = diameter * 0.08; // 8% of diameter
    middle_ring_offset = outer_ring_thickness + (diameter * 0.02); // 2% spacing
    middle_ring_thickness = diameter * 0.08; // 8% of diameter
    inner_ring_offset = middle_ring_offset + middle_ring_thickness + (diameter * 0.02); // 2% spacing
    
    // Scaled parameters
    cross_width = diameter * 0.053;
    cross_height = diameter * 0.267;
    
    // Bridge parameters
    bridge_width = bridge_base_width; // Could optionally scale with diameter using: diameter * 0.083
    bridge_height = diameter * 0.16;
    
    union() {
        create_rings(button_radius, outer_ring_thickness, middle_ring_offset, 
                    middle_ring_thickness, inner_ring_offset, outer_ring_height, 
                    cross_width, cross_height, bend_height);
        
        // Calculate bridge positions based on ring positions
        // West bridge - spans from outer ring to middle ring
        translate([-(button_radius - inner_ring_offset), 0, bend_height/2]) 
            cube([middle_ring_offset - 0.2, bridge_height, bend_height], center = true);
        
        // East bridge - spans from middle ring to inner ring
        translate([button_radius - inner_ring_offset, 0, bend_height/2]) 
            cube([inner_ring_offset - middle_ring_offset - 0.2, bridge_height, bend_height], center = true);
        
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
        cylinder(h=bend_h, r=r-middle_offset);
        cylinder(h=bend_h, r=r-middle_offset-middle_thickness);
    }
    // Create Inner ring with cross  
    difference() {   
        cylinder(h=bend_h, r=r-inner_offset);
        cube([cross_h, cross_w, bend_h*3], center = true);
        cube([cross_w, cross_h, bend_h*3], center = true);
    }
}

