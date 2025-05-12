pin_diameter = 1.02*1.03;
spacing = 2.54;
pin_height = 6;
pins1 = 16; // Number of pins
pins2 = 16; // Number of pins
row_spacing = 32.6-4;

$fn=32;

module create_pin() {
    // Create the pin with a cylinder and cube for the base
    difference() {
        cube([spacing,spacing,pin_height],center=true);
        cube([pin_diameter,pin_diameter,pin_height], center=true);
    }
}


//Create pins in a line
for (i = [0:pins1-1]) {
    translate([i*spacing, 0, 0]) {
        create_pin();
    }
}

translate([0, row_spacing, 0]) {
    for (i = [0:pins2-1]) {
        translate([i*spacing, 0, 0]) {
            create_pin();
        }
    }
}
