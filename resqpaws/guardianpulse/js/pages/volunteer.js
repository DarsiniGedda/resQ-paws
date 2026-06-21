// Volunteer Registration Page Controller
document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.getElementById("volunteer-map");
  
  // 1. Initialize Map showing active NGOs and Volunteers
  if (mapElement) {
    window.GPMap.initMap("volunteer-map", [12.9716, 77.5946], 12);
    
    try {
      // Plot NGOs
      const ngos = await window.GPDB.getNgos();
      ngos.forEach(ngo => {
        window.GPMap.addNgoMarker(ngo);
      });

      // Plot Volunteers
      const volunteers = await window.GPDB.getVolunteers();
      volunteers.forEach(vol => {
        window.GPMap.addVolunteerMarker(vol);
      });
    } catch (err) {
      console.error("Map plot failure:", err);
    }
  }

  // 2. Submit volunteer registration
  const volForm = document.getElementById("volunteer-registration-form");
  if (volForm) {
    volForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("vol-name").value;
      const phone = document.getElementById("vol-phone").value;
      const email = document.getElementById("vol-email").value;
      const city = document.getElementById("vol-city").value;

      // Mock coordinates mapping based on city input (simple fallback)
      let lat = 12.9716 + (Math.random() - 0.5) * 0.1;
      let lng = 77.5946 + (Math.random() - 0.5) * 0.1;

      const volunteerData = {
        name: name,
        phone: phone,
        email: email,
        city: city,
        location: { lat, lng }
      };

      try {
        const savedVol = await window.GPDB.registerVolunteer(volunteerData);
        alert(`Thank you ${name}! You have successfully registered as a GuardianPulse volunteer.`);
        volForm.reset();
        
        // Refresh markers on map
        window.GPMap.clearMarkers();
        
        const ngos = await window.GPDB.getNgos();
        ngos.forEach(ngo => window.GPMap.addNgoMarker(ngo));

        const volunteers = await window.GPDB.getVolunteers();
        volunteers.forEach(vol => window.GPMap.addVolunteerMarker(vol));
        
        // Center view on volunteer coordinates
        window.GPMap.panTo(savedVol.location.lat, savedVol.location.lng, 13);
        
      } catch (err) {
        console.error(err);
        alert("Registration failed. Please try again.");
      }
    });
  }
});
