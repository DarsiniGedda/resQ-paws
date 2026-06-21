// Emergency Reporting Page Controller
document.addEventListener("DOMContentLoaded", async () => {
  // Wait for Auth session to load securely
  const currentUser = await window.GPAuth.waitForUser();
  if (!currentUser) {
    alert("Please login first to report an emergency.");
    window.location.href = "login.html";
    return;
  }

  // 1. Initialize coordinates selection Leaflet Map
  const mapElement = document.getElementById("report-map");
  if (mapElement) {
    window.GPMap.initMap("report-map");
    window.GPMap.enableCoordinatesPicker((lat, lng) => {
      document.getElementById("report-lat").value = lat.toFixed(6);
      document.getElementById("report-lng").value = lng.toFixed(6);
      document.getElementById("location-coords-display").textContent = `Coords selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    });
  }

  // 2. Image upload preview
  const imageInput = document.getElementById("report-image-input");
  const previewImg = document.getElementById("report-image-preview");
  const uploadContainer = document.getElementById("upload-preview-container");
  
  if (imageInput && previewImg) {
    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          previewImg.src = event.target.result;
          uploadContainer.style.display = "block";
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // 3. Form submit & AI Assessment simulation
  const reportForm = document.getElementById("report-emergency-form");
  const aiProgressPanel = document.getElementById("ai-progress-panel");
  const reportSubmitBtn = document.getElementById("report-submit-btn");

  if (reportForm) {
    reportForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const animalType = document.getElementById("animal-type").value;
      const description = document.getElementById("description").value;
      const locationName = document.getElementById("location-name").value;
      const contactNumber = document.getElementById("contact-number").value;
      const lat = parseFloat(document.getElementById("report-lat").value);
      const lng = parseFloat(document.getElementById("report-lng").value);

      if (!lat || !lng) {
        alert("Please click on the map to pinpoint the exact rescue coordinates.");
        return;
      }

      // Show AI scanner layout
      aiProgressPanel.style.display = "block";
      reportSubmitBtn.disabled = true;
      
      const scanLaser = document.createElement("div");
      scanLaser.className = "scan-laser";
      const scannerWrapper = document.querySelector(".scanner-container");
      if (scannerWrapper) {
        scannerWrapper.appendChild(scanLaser);
      }
      
      const statusText = document.getElementById("ai-status-text");
      if (statusText) statusText.textContent = "AI-Assisted Assessment: Loading vision parameters...";

      try {
        // Trigger simulated analysis
        const assessment = await window.GPAI.analyzeIncidentDemo(animalType, description, imageInput.files[0]);
        
        if (statusText) statusText.textContent = "Vision scan complete. Mapping assessment variables...";
        
        // Render Simulated AI Results
        document.getElementById("ai-result-severity").textContent = assessment.severity;
        const badge = document.getElementById("ai-result-severity");
        badge.className = `badge badge-${assessment.severity.toLowerCase()}`;
        
        document.getElementById("ai-result-confidence").textContent = `${assessment.confidence}%`;
        document.getElementById("ai-result-injury").textContent = assessment.aiDetails.injuryDetected;
        document.getElementById("ai-result-blood").textContent = assessment.aiDetails.bloodVisible;
        document.getElementById("ai-result-mobility").textContent = assessment.aiDetails.mobilityIssue;
        document.getElementById("ai-result-distress").textContent = assessment.aiDetails.distressLevel;
        document.getElementById("ai-result-condition").textContent = assessment.aiDetails.condition;

        // Show results grid
        document.getElementById("ai-results-grid").style.display = "block";
        if (statusText) statusText.textContent = "Simulated AI Severity Assessment: Complete!";

        // Add a slight delay before DB saving to let user view assessment results
        setTimeout(async () => {
          if (statusText) statusText.textContent = "Uploading emergency report to GuardianPulse database...";
          
          const finalReportData = {
            reporterId: currentUser.uid,
            reporterName: currentUser.name,
            contactNumber: contactNumber,
            animalType: animalType,
            description: description,
            imageUrl: previewImg.src || "assets/placeholder.png",
            locationName: locationName,
            lat: lat,
            lng: lng,
            severity: assessment.severity,
            confidence: assessment.confidence,
            aiDetails: assessment.aiDetails
          };

          const savedReport = await window.GPDB.submitReport(finalReportData);
          alert(`Success! Emergency registered with Tracking ID: ${savedReport.id}`);
          window.location.href = `track.html?id=${savedReport.id}`;
        }, 3000);

      } catch (err) {
        console.error(err);
        alert("An error occurred during assessment. Please try again.");
        reportSubmitBtn.disabled = false;
        aiProgressPanel.style.display = "none";
        if (scanLaser.parentNode) scanLaser.parentNode.removeChild(scanLaser);
      }
    });
  }
});
