// GuardianPulse Dashboard Controller
// Handles both Public User and NGO Rescuer dashboards.

(async function initDashboard() {
  // 1. Wait for Auth state initialization
  const user = await window.GPAuth.waitForUser();

  // 🚫 NOT LOGGED IN → REDIRECT
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  console.log("Dashboard loaded for user:", user);

  // 👤 PROFILE CARD UPDATE
  const nameEl = document.getElementById("profile-name-display");
  const roleEl = document.getElementById("profile-role-display");
  const avatarEl = document.getElementById("profile-avatar-display");

  if (nameEl) nameEl.textContent = user.name || user.email;
  if (roleEl) {
    if (user.role === "ngo") {
      roleEl.textContent = "NGO Rescuer (Admin)";
    } else if (user.role === "volunteer") {
      roleEl.textContent = "Registered Volunteer";
    } else {
      roleEl.textContent = "Public Reporter";
    }
  }
  if (avatarEl) avatarEl.src = user.avatar || "assets/placeholder.png";

  // 🚪 LOGOUT BUTTON
  const logoutBtn = document.getElementById("nav-logout-btn");
  if (logoutBtn) {
    logoutBtn.style.display = "inline-block";
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await window.GPAuth.logout();
      window.location.href = "login.html";
    });
  }

  // 🛠 ROUTE DASHBOARD LOGIC BASED ON ROLE
  if (user.role === "ngo") {
    await initNgoDashboard(user);
  } else {
    await initUserDashboard(user);
  }
})();

// ==========================================
// 🚨 NGO DASHBOARD LOGIC
// ==========================================
async function initNgoDashboard(ngoUser) {
  // 1. Availability Status Controls
  const statusSpan = document.getElementById("ngo-availability-status");
  const statusButtons = document.querySelectorAll(".ngo-status-controls .ngo-status-btn");
  
  // Fetch current NGO details from DB
  let ngosList = await window.GPDB.getNgos();
  let currentNgo = ngosList.find(n => n.id === ngoUser.uid);
  
  // If current NGO doesn't exist in the list (e.g. new registration), register default status
  if (!currentNgo) {
    currentNgo = { id: ngoUser.uid, name: ngoUser.name, email: ngoUser.email, status: "Available" };
  }

  function updateStatusUI(status) {
    if (!statusSpan) return;
    statusSpan.textContent = status;
    statusSpan.className = `badge badge-${status.toLowerCase()}`;

    statusButtons.forEach(btn => {
      if (btn.textContent.trim().toLowerCase() === status.toLowerCase()) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  updateStatusUI(currentNgo.status);

  // Status buttons listeners
  statusButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const selectedStatus = btn.textContent.trim(); // "Available", "Busy", "Offline"
      try {
        await window.GPDB.updateNgoStatus(ngoUser.uid, selectedStatus);
        updateStatusUI(selectedStatus);
      } catch (err) {
        alert("Failed to update status: " + err.message);
      }
    });
  });

  // 2. Load NGO metrics and lists
  async function loadNgoData() {
    try {
      const allReports = await window.GPDB.getReports();
      const allVolunteers = await window.GPDB.getVolunteers();
      const allNgos = await window.GPDB.getNgos();
      const notifications = await window.GPDB.getNotifications(ngoUser.uid);

      // Calculations
      const newIncidents = allReports.filter(r => r.status === "Reported");
      const activeRescues = allReports.filter(r => r.assignedNgoId === ngoUser.uid && ["Accepted", "Team Dispatched", "Treatment Ongoing"].includes(r.status));
      const completedRescues = allReports.filter(r => r.assignedNgoId === ngoUser.uid && ["Animal Rescued", "Recovered"].includes(r.status));

      // Update counters
      const newEl = document.getElementById("stat-ngo-new");
      const activeEl = document.getElementById("stat-ngo-active");
      const compEl = document.getElementById("stat-ngo-completed");
      const volEl = document.getElementById("stat-ngo-volunteers");

      if (newEl) newEl.textContent = newIncidents.length;
      if (activeEl) activeEl.textContent = activeRescues.length;
      if (compEl) compEl.textContent = completedRescues.length;
      if (volEl) volEl.textContent = allVolunteers.length;

      // 3. Render NGO active map
      const mapEl = document.getElementById("ngo-dash-map");
      if (mapEl && window.GPMap) {
        const map = window.GPMap.initMap("ngo-dash-map");
        if (map) {
          window.GPMap.clearMarkers();
          
          // Plot current NGO position (if available)
          const myNgo = allNgos.find(n => n.id === ngoUser.uid);
          if (myNgo && myNgo.location) {
            window.GPMap.addNgoMarker(myNgo);
            window.GPMap.panTo(myNgo.location.lat, myNgo.location.lng, 12);
          }
          
          // Plot all other NGOs
          allNgos.forEach(ngo => {
            if (ngo.id !== ngoUser.uid) {
              window.GPMap.addNgoMarker(ngo);
            }
          });

          // Plot all reports
          allReports.forEach(report => {
            window.GPMap.addEmergencyMarker(report);
          });

          // Plot all volunteers
          allVolunteers.forEach(vol => {
            window.GPMap.addVolunteerMarker(vol);
          });
        }
      }

      // 4. Populate Incoming Emergency alerts panel
      const alertsPane = document.getElementById("ngo-alerts-pane");
      if (alertsPane) {
        alertsPane.innerHTML = "";
        
        if (newIncidents.length === 0) {
          alertsPane.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:24px; font-size:0.95rem;">No new incoming reports. All quiet!</div>`;
        } else {
          newIncidents.forEach(incident => {
            const card = document.createElement("div");
            card.className = "glass-card no-lift";
            card.style.padding = "16px";
            card.style.marginBottom = "12px";
            card.style.borderLeft = "4px solid " + (incident.severity === 'Critical' ? '#EF4444' : incident.severity === 'High' ? '#F97316' : '#F59E0B');

            card.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="color:var(--primary); font-size:0.9rem;">${incident.id}</strong>
                <span class="badge badge-${incident.severity.toLowerCase()}">${incident.severity}</span>
              </div>
              <p style="font-size:0.9rem; margin-bottom:6px;"><strong>Animal:</strong> ${incident.animalType}</p>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${incident.description}</p>
              <p style="font-size:0.85rem; margin-bottom:12px;">📍 <em>${incident.locationName || "Location Coordinates"}</em></p>
              
              <button class="btn btn-primary btn-sm accept-btn" data-id="${incident.id}" style="width:100%;">Accept Rescue Request</button>
            `;

            alertsPane.appendChild(card);
          });

          // Accept button event listeners
          alertsPane.querySelectorAll(".accept-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
              const id = e.target.getAttribute("data-id");
              try {
                // Read current status
                let updatedNgos = await window.GPDB.getNgos();
                let myNgoDetails = updatedNgos.find(n => n.id === ngoUser.uid);
                if (myNgoDetails && (myNgoDetails.status === "Busy" || myNgoDetails.status === "Offline")) {
                  alert(`You cannot accept rescues when your availability is marked as: ${myNgoDetails.status}. Please toggle your status to "Available" first.`);
                  return;
                }

                e.target.disabled = true;
                e.target.textContent = "Accepting...";
                await window.GPDB.acceptRescue(id, ngoUser.uid);
                alert(`Rescue case ${id} successfully assigned to you!`);
                await loadNgoData();
              } catch (err) {
                alert("Failed to accept rescue: " + err.message);
                e.target.disabled = false;
                e.target.textContent = "Accept Rescue Request";
              }
            });
          });
        }
      }

      // 5. Populate Active Rescues Coordination Table
      const activeTableBody = document.getElementById("ngo-active-table-body");
      if (activeTableBody) {
        activeTableBody.innerHTML = "";
        
        if (activeRescues.length === 0) {
          activeTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No active rescue cases under coordination.</td></tr>`;
        } else {
          activeRescues.forEach(rescue => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td><strong>${rescue.id}</strong></td>
              <td>${rescue.animalType}</td>
              <td><span class="badge badge-${rescue.severity.toLowerCase()}">${rescue.severity}</span></td>
              <td>
                <select class="form-control status-select" style="padding:6px; font-size:0.85rem; min-width:140px;">
                  <option value="Accepted" ${rescue.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                  <option value="Team Dispatched" ${rescue.status === 'Team Dispatched' ? 'selected' : ''}>Team Dispatched</option>
                  <option value="Animal Rescued" ${rescue.status === 'Animal Rescued' ? 'selected' : ''}>Animal Rescued</option>
                  <option value="Treatment Ongoing" ${rescue.status === 'Treatment Ongoing' ? 'selected' : ''}>Treatment Ongoing</option>
                  <option value="Recovered" ${rescue.status === 'Recovered' ? 'selected' : ''}>Recovered</option>
                </select>
              </td>
              <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <button class="btn btn-outline btn-sm update-status-btn" data-id="${rescue.id}">Update</button>
                  ${rescue.status === 'Recovered' ? `<button class="btn btn-primary btn-sm move-adoption-btn" data-id="${rescue.id}" data-animal="${rescue.animalType}" data-loc="${rescue.locationName}">To Adoption</button>` : ''}
                </div>
              </td>
              <td>
                <a href="track.html?id=${rescue.id}" class="btn btn-primary btn-sm" style="padding: 6px 12px; font-size:0.8rem;">Track Case</a>
              </td>
            `;

            activeTableBody.appendChild(tr);
          });

          // Update Status button listeners
          activeTableBody.querySelectorAll(".update-status-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
              const id = e.target.getAttribute("data-id");
              const tr = e.target.closest("tr");
              const select = tr.querySelector(".status-select");
              const status = select.value;

              e.target.disabled = true;
              e.target.textContent = "Updating...";

              try {
                await window.GPDB.updateRescueStatus(id, status, ngoUser.uid);
                alert(`Rescue case ${id} updated to status: ${status}`);
                await loadNgoData();
              } catch (err) {
                alert("Failed to update rescue case status: " + err.message);
                e.target.disabled = false;
                e.target.textContent = "Update";
              }
            });
          });

          // Move to Adoption button listeners
          activeTableBody.querySelectorAll(".move-adoption-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
              const id = e.target.getAttribute("data-id");
              const animalType = e.target.getAttribute("data-animal");
              const locationName = e.target.getAttribute("data-loc");
              
              if(confirm(`Generate an adoption profile for Rescue ${id} (${animalType})?`)) {
                e.target.disabled = true;
                e.target.textContent = "...";
                try {
                  const newAdoption = {
                    name: `Rescue ${id}`,
                    species: animalType,
                    breed: "Unknown",
                    age: "Unknown",
                    gender: "Unknown",
                    size: "Medium",
                    location: locationName || "Local Shelter",
                    status: "Available",
                    healthStatus: "Fully recovered.",
                    traits: ["Friendly", "Rescued"],
                    story: `This brave ${animalType} was rescued via GuardianPulse and has now fully recovered and is ready for a forever home!`
                  };
                  await window.GPDB.addAdoptionListing(newAdoption);
                  await window.GPDB.updateRescueStatus(id, "Closed - Adoptable", ngoUser.uid);
                  alert(`Adoption profile created successfully! Rescue case closed.`);
                  await loadNgoData();
                } catch(err) {
                  alert("Failed to create adoption profile: " + err.message);
                  e.target.disabled = false;
                  e.target.textContent = "To Adoption";
                }
              }
            });
          });
        }
      }

      // 6. Populate Regional Volunteer Contacts Table
      const volunteersListBody = document.getElementById("ngo-volunteers-list-body");
      if (volunteersListBody) {
        volunteersListBody.innerHTML = "";
        
        if (allVolunteers.length === 0) {
          volunteersListBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No volunteers registered in this region yet.</td></tr>`;
        } else {
          allVolunteers.forEach(vol => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td><strong>${vol.name}</strong></td>
              <td>${vol.city || "Bangalore"}</td>
              <td>${vol.phone || "Helpline number not given"}</td>
              <td>
                <a href="mailto:${vol.email}" class="btn btn-outline btn-sm" style="padding:4px 8px; font-size:0.75rem;">Email Contact</a>
              </td>
            `;
            volunteersListBody.appendChild(tr);
          });
        }
      }

      // 7. Render Notifications list
      const notificationsList = document.getElementById("ngo-notifications-list");
      if (notificationsList) {
        notificationsList.innerHTML = "";
        
        if (notifications.length === 0) {
          notificationsList.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:24px;">No alerts. Notification log is empty.</div>`;
        } else {
          notifications.forEach(notif => {
            const notifItem = document.createElement("div");
            notifItem.className = "glass-card no-lift";
            notifItem.style.padding = "12px 16px";
            notifItem.style.marginBottom = "8px";
            notifItem.style.opacity = notif.read ? "0.7" : "1.0";
            notifItem.style.backgroundColor = notif.read ? "transparent" : "rgba(22, 163, 74, 0.05)";

            const formattedTime = new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            notifItem.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong style="font-size:0.9rem; color:var(--text-main);">${notif.title}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted);">${formattedTime}</span>
              </div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">${notif.message}</p>
            `;
            notificationsList.appendChild(notifItem);
          });

          // Mark notification as read when loading dashboard
          await window.GPDB.markNotificationsAsRead(ngoUser.uid);
        }
      }

    } catch (err) {
      console.error("NGO dashboard load failed:", err);
    }
  }

  await loadNgoData();
}

// ==========================================
// 🙋 PUBLIC USER DASHBOARD LOGIC
// ==========================================
async function initUserDashboard(user) {
  async function loadUserData() {
    try {
      const myReports = await window.GPDB.getUserReports(user.uid);
      const notifications = await window.GPDB.getNotifications(user.uid);
      const lostFound = await window.GPDB.getLostFound();

      // Calculations
      const totalReports = myReports.length;
      const activeReports = myReports.filter(r => !["Recovered", "Closed"].includes(r.status));
      const rescuedReports = myReports.filter(r => ["Animal Rescued", "Recovered"].includes(r.status));
      const myLostFound = lostFound.filter(lf => lf.reporterId === user.uid || lf.email === user.email);

      // Populate counters
      const repEl = document.getElementById("stat-user-reports");
      const actEl = document.getElementById("stat-user-active");
      const rescEl = document.getElementById("stat-user-rescued");
      const lfEl = document.getElementById("stat-user-lostfound");

      if (repEl) repEl.textContent = totalReports;
      if (actEl) actEl.textContent = activeReports.length;
      if (rescEl) rescEl.textContent = rescuedReports.length;
      if (lfEl) lfEl.textContent = myLostFound.length;

      // Populate user history table
      const historyTable = document.getElementById("user-history-table-body");
      if (historyTable) {
        historyTable.innerHTML = "";
        
        if (myReports.length === 0) {
          historyTable.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No rescue cases reported by you yet.</td></tr>`;
        } else {
          myReports.forEach(report => {
            const tr = document.createElement("tr");
            
            // date formatter
            const reportDate = new Date(report.createdDate || Date.now()).toLocaleDateString([], {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            tr.innerHTML = `
              <td><strong>${report.id}</strong></td>
              <td>${report.animalType}</td>
              <td>${reportDate}</td>
              <td><span class="badge badge-${report.severity.toLowerCase()}">${report.severity}</span></td>
              <td><span class="badge badge-${report.status.toLowerCase().replace(" ", "-")}">${report.status}</span></td>
              <td>
                <a href="track.html?id=${report.id}" class="btn btn-primary btn-sm" style="padding: 6px 12px; font-size:0.8rem;">Track Case</a>
              </td>
            `;

            historyTable.appendChild(tr);
          });
        }
      }

      // Populate notifications log list
      const notificationsList = document.getElementById("user-notifications-list");
      if (notificationsList) {
        notificationsList.innerHTML = "";
        
        if (notifications.length === 0) {
          notificationsList.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:24px;">No alerts. Notification log is empty.</div>`;
        } else {
          notifications.forEach(notif => {
            const notifItem = document.createElement("div");
            notifItem.className = "glass-card no-lift";
            notifItem.style.padding = "12px 16px";
            notifItem.style.marginBottom = "8px";
            notifItem.style.opacity = notif.read ? "0.7" : "1.0";
            notifItem.style.backgroundColor = notif.read ? "transparent" : "rgba(22, 163, 74, 0.05)";

            const formattedTime = new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            notifItem.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong style="font-size:0.9rem; color:var(--text-main);">${notif.title}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted);">${formattedTime}</span>
              </div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">${notif.message}</p>
            `;
            notificationsList.appendChild(notifItem);
          });

          // Mark notification as read when loading dashboard
          await window.GPDB.markNotificationsAsRead(user.uid);
        }
      }

    } catch (err) {
      console.error("User dashboard load failed:", err);
    }
  }

  await loadUserData();
}