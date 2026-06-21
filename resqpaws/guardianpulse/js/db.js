// resQpaws Database Operations Module
// Interacts with Firestore database or LocalStorage API mock database.

const GPDB = {
  // Helper to read LocalStorage
  _readLocal: function(key) {
    return JSON.parse(localStorage.getItem(key) || "[]");
  },

  // Helper to write LocalStorage
  _writeLocal: function(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  // --- EMERGENCY REPORTS ---

  // Submit emergency report
  submitReport: async function(reportData) {
    if (window.GuardianPulse.isDemoMode) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const reports = this._readLocal("gp_reports");
          
          // Generate unique ID in the format GP-2026-001, GP-2026-002...
          const currentYear = new Date().getFullYear();
          const count = reports.length + 1;
          const trackingId = `GP-${currentYear}-${String(count).padStart(3, '0')}`;
          
          const newReport = {
            id: trackingId,
            status: "Reported",
            createdDate: new Date().toISOString(),
            assignedNgoId: null,
            ...reportData
          };
          
          reports.push(newReport);
          this._writeLocal("gp_reports", reports);

          // Add a notification for user
          this.createNotification(
            reportData.reporterId || "user-1",
            "Emergency Filed Successfully",
            `Emergency report ${trackingId} for a ${reportData.animalType} has been successfully filed and is Under Review.`
          );

          // Add notification to ALL available NGOs
          const ngos = this._readLocal("gp_ngos");
          ngos.forEach(ngo => {
            if (ngo.status === "Available") {
              this.createNotification(
                ngo.id,
                "New Emergency Alert!",
                `A new emergency ${trackingId} has been reported near ${reportData.locationName}.`
              );
            }
          });

          resolve(newReport);
        }, 1000);
      });
    } else {
      // Firebase Firestore implementation
      try {
        const reportsRef = window.GuardianPulse.firestore.collection("reports");
        const snapshot = await reportsRef.get();
        const currentYear = new Date().getFullYear();
        const count = snapshot.size + 1;
        const trackingId = `GP-${currentYear}-${String(count).padStart(3, '0')}`;
        
        const newReport = {
          id: trackingId,
          status: "Reported",
          createdDate: new Date().toISOString(),
          assignedNgoId: null,
          ...reportData
        };

        await reportsRef.doc(trackingId).set(newReport);

        // Save Notifications
        await this.createNotification(reportData.reporterId, "Emergency Filed Successfully", `Emergency report ${trackingId} for a ${reportData.animalType} has been successfully filed.`);
        
        const ngosSnapshot = await window.GuardianPulse.firestore.collection("ngos").where("status", "==", "Available").get();
        ngosSnapshot.forEach(async (doc) => {
          await this.createNotification(doc.id, "New Emergency Alert!", `A new emergency ${trackingId} has been reported.`);
        });

        return newReport;
      } catch (err) {
        throw err;
      }
    }
  },

  // Fetch all reports
  getReports: async function() {
    if (window.GuardianPulse.isDemoMode) {
      return Promise.resolve(this._readLocal("gp_reports"));
    } else {
      try {
        const snapshot = await window.GuardianPulse.firestore.collection("reports").orderBy("createdDate", "desc").get();
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
      } catch (err) {
        throw err;
      }
    }
  },

  // Fetch reports filed by specific user
  getUserReports: async function(userId) {
    if (window.GuardianPulse.isDemoMode) {
      const reports = this._readLocal("gp_reports");
      return Promise.resolve(reports.filter(r => r.reporterId === userId));
    } else {
      try {
        const snapshot = await window.GuardianPulse.firestore.collection("reports")
          .where("reporterId", "==", userId)
          .get();
        const list = [];
        snapshot.forEach(doc => list.push(doc.data()));
        return list;
      } catch (err) {
        throw err;
      }
    }
  },

  // Fetch report details by tracking ID
  getReportById: async function(reportId) {
    if (window.GuardianPulse.isDemoMode) {
      const reports = this._readLocal("gp_reports");
      const report = reports.find(r => r.id === reportId);
      return Promise.resolve(report || null);
    } else {
      try {
        const doc = await window.GuardianPulse.firestore.collection("reports").doc(reportId).get();
        return doc.exists ? doc.data() : null;
      } catch (err) {
        throw err;
      }
    }
  },

  // NGO accepts rescue request
  acceptRescue: async function(reportId, ngoId) {
    if (window.GuardianPulse.isDemoMode) {
      return new Promise((resolve, reject) => {
        const ngos = this._readLocal("gp_ngos");
        const ngo = ngos.find(n => n.id === ngoId);
        if (ngo && (ngo.status === "Busy" || ngo.status === "Offline")) {
          reject(new Error("You are currently marked as Busy or Offline and cannot accept new rescues."));
          return;
        }

        const reports = this._readLocal("gp_reports");
        const idx = reports.findIndex(r => r.id === reportId);
        if (idx !== -1) {
          reports[idx].status = "Accepted";
          reports[idx].assignedNgoId = ngoId;
          this._writeLocal("gp_reports", reports);

          // Add notifications
          this.createNotification(
            reports[idx].reporterId,
            "Rescue Accepted",
            `NGO ${ngo ? ngo.name : "A nearby NGO"} has accepted your emergency request ${reportId} and is currently reviewing the details.`
          );
          
          resolve(reports[idx]);
        } else {
          reject(new Error("Report not found."));
        }
      });
    } else {
      try {
        const docRef = window.GuardianPulse.firestore.collection("reports").doc(reportId);
        const doc = await docRef.get();
        if (doc.exists) {
          const report = doc.data();
          
          // Verify NGO availability
          const ngoDoc = await window.GuardianPulse.firestore.collection("ngos").doc(ngoId).get();
          if (ngoDoc.exists && (ngoDoc.data().status === "Busy" || ngoDoc.data().status === "Offline")) {
            throw new Error("NGO status is Busy or Offline. Request blocked.");
          }

          await docRef.update({
            status: "Accepted",
            assignedNgoId: ngoId
          });
          
          await this.createNotification(report.reporterId, "Rescue Accepted", `Your rescue request ${reportId} was accepted.`);
          return { ...report, status: "Accepted", assignedNgoId: ngoId };
        }
      } catch (err) {
        throw err;
      }
    }
  },

  // NGO updates rescue status progress
  updateRescueStatus: async function(reportId, status, updaterId) {
    if (window.GuardianPulse.isDemoMode) {
      return new Promise((resolve) => {
        const reports = this._readLocal("gp_reports");
        const idx = reports.findIndex(r => r.id === reportId);
        if (idx !== -1) {
          reports[idx].status = status;
          this._writeLocal("gp_reports", reports);

          // Customize notification message based on status
          let msg = `Rescue case ${reportId} status updated to: ${status}.`;
          if (status === "Team Dispatched") {
            msg = `A rescue team has been dispatched for case ${reportId}. Please stay available on your contact number.`;
          } else if (status === "Animal Rescued") {
            msg = `Success! The animal in case ${reportId} has been successfully secured and rescued.`;
          } else if (status === "Treatment Ongoing") {
            msg = `The animal in case ${reportId} is currently undergoing treatment at our veterinary wing.`;
          } else if (status === "Recovered") {
            msg = `Great news! The animal in case ${reportId} has recovered and is ready for shelter release/adoption.`;
          }

          this.createNotification(reports[idx].reporterId, "Rescue Status Update", msg);
          resolve(reports[idx]);
        }
      });
    } else {
      try {
        const docRef = window.GuardianPulse.firestore.collection("reports").doc(reportId);
        const doc = await docRef.get();
        if (doc.exists) {
          const report = doc.data();
          await docRef.update({ status: status });
          
          let msg = `Rescue case ${reportId} status updated to: ${status}.`;
          if (status === "Team Dispatched") msg = `A rescue team has been dispatched for case ${reportId}.`;
          else if (status === "Animal Rescued") msg = `The animal in case ${reportId} has been rescued.`;
          else if (status === "Treatment Ongoing") msg = `The animal in case ${reportId} is currently undergoing treatment.`;
          else if (status === "Recovered") msg = `The animal in case ${reportId} has fully recovered.`;

          await this.createNotification(report.reporterId, "Rescue Status Update", msg);
          return { ...report, status: status };
        }
      } catch (err) {
        throw err;
      }
    }
  },

  // --- NGO CONTROLS ---

  getNgos: async function() {
    if (window.GuardianPulse.isDemoMode) {
      return Promise.resolve(this._readLocal("gp_ngos"));
    } else {
      const snapshot = await window.GuardianPulse.firestore.collection("ngos").get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    }
  },

  updateNgoStatus: async function(ngoId, status) {
    if (window.GuardianPulse.isDemoMode) {
      const ngos = this._readLocal("gp_ngos");
      const idx = ngos.findIndex(n => n.id === ngoId);
      if (idx !== -1) {
        ngos[idx].status = status;
        this._writeLocal("gp_ngos", ngos);
        return Promise.resolve(ngos[idx]);
      }
    } else {
      await window.GuardianPulse.firestore.collection("ngos").doc(ngoId).update({ status: status });
      return { id: ngoId, status: status };
    }
  },

  // --- VOLUNTEERS ---

  registerVolunteer: async function(volunteerData) {
    if (window.GuardianPulse.isDemoMode) {
      const volunteers = this._readLocal("gp_volunteers");
      const newVol = {
        id: "vol-" + Date.now(),
        ...volunteerData
      };
      volunteers.push(newVol);
      this._writeLocal("gp_volunteers", volunteers);
      return Promise.resolve(newVol);
    } else {
      const docRef = window.GuardianPulse.firestore.collection("volunteers").doc();
      const newVol = { id: docRef.id, ...volunteerData };
      await docRef.set(newVol);
      return newVol;
    }
  },

  getVolunteers: async function() {
    if (window.GuardianPulse.isDemoMode) {
      return Promise.resolve(this._readLocal("gp_volunteers"));
    } else {
      const snapshot = await window.GuardianPulse.firestore.collection("volunteers").get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    }
  },

  // --- NOTIFICATIONS ---

  createNotification: async function(userId, title, message) {
    const notif = {
      id: "notif-" + Date.now() + Math.random().toString(36).substr(2, 5),
      userId: userId,
      title: title,
      message: message,
      date: new Date().toISOString(),
      read: false
    };

    if (window.GuardianPulse.isDemoMode) {
      const notifs = this._readLocal("gp_notifications");
      notifs.unshift(notif);
      this._writeLocal("gp_notifications", notifs);
      return Promise.resolve(notif);
    } else {
      await window.GuardianPulse.firestore.collection("notifications").doc(notif.id).set(notif);
      return notif;
    }
  },

  getNotifications: async function(userId) {
    if (window.GuardianPulse.isDemoMode) {
      const notifs = this._readLocal("gp_notifications");
      return Promise.resolve(notifs.filter(n => n.userId === userId));
    } else {
      const snapshot = await window.GuardianPulse.firestore.collection("notifications")
        .where("userId", "==", userId)
        .orderBy("date", "desc")
        .get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    }
  },

  markNotificationsAsRead: async function(userId) {
    if (window.GuardianPulse.isDemoMode) {
      const notifs = this._readLocal("gp_notifications");
      notifs.forEach(n => {
        if (n.userId === userId) n.read = true;
      });
      this._writeLocal("gp_notifications", notifs);
      return Promise.resolve();
    } else {
      const batch = window.GuardianPulse.firestore.batch();
      const snapshot = await window.GuardianPulse.firestore.collection("notifications")
        .where("userId", "==", userId)
        .where("read", "==", false)
        .get();
      snapshot.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();
      return;
    }
  },

  // --- LOST & FOUND Matching Engine ---

  submitLostFound: async function(recordData) {
    if (window.GuardianPulse.isDemoMode) {
      const records = this._readLocal("gp_lostfound");
      const newRecord = {
        id: "lf-" + Date.now(),
        date: new Date().toISOString().split('T')[0],
        ...recordData
      };
      records.push(newRecord);
      this._writeLocal("gp_lostfound", records);
      return Promise.resolve(newRecord);
    } else {
      const docRef = window.GuardianPulse.firestore.collection("lostfound").doc();
      const newRecord = { id: docRef.id, date: new Date().toISOString().split('T')[0], ...recordData };
      await docRef.set(newRecord);
      return newRecord;
    }
  },

  getLostFound: async function() {
    if (window.GuardianPulse.isDemoMode) {
      return Promise.resolve(this._readLocal("gp_lostfound"));
    } else {
      const snapshot = await window.GuardianPulse.firestore.collection("lostfound").get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    }
  },

  // Core match algorithm: Calculates a matching percentage between standard Lost & Found postings
  // Criteria: Type alignment (one Lost, one Found), Animal Type match, and location + keyword string intersections
  findMatchesForRecord: function(record, allRecords) {
    if (!record) return [];
    
    // We only compare a 'Lost' report against 'Found' reports, and vice versa
    const targetType = record.type === 'Lost' ? 'Found' : 'Lost';
    
    return allRecords
      .filter(item => item.type === targetType && item.id !== record.id)
      .map(item => {
        let matchScore = 0;
        let reasons = [];

        // 1. Animal Type check (absolute requirement for a match)
        if (item.animalType.toLowerCase() !== record.animalType.toLowerCase()) {
          return { item, matchPercentage: 0, reasons: [] };
        }
        matchScore += 40; // 40% starting score if same animal type
        reasons.push("Same animal classification");

        // 2. Location comparison
        const loc1 = record.location.toLowerCase();
        const loc2 = item.location.toLowerCase();
        
        // Check for substring matches in location words (e.g. "Koramangala", "Indiranagar")
        const loc1Words = loc1.split(/[\s,]+/);
        const loc2Words = loc2.split(/[\s,]+/);
        const locationOverlap = loc1Words.filter(w => w.length > 3 && loc2Words.includes(w));
        
        if (loc1 === loc2) {
          matchScore += 30;
          reasons.push("Exact location matches");
        } else if (locationOverlap.length > 0) {
          matchScore += 20;
          reasons.push(`Similar locations flagged (${locationOverlap.join(', ')})`);
        }

        // 3. Keyword / Description tokens analysis
        const key1 = (record.keywords || "").toLowerCase().split(/[\s,]+/);
        const key2 = (item.keywords || "").toLowerCase().split(/[\s,]+/);
        
        // Also analyze description text words
        const desc1 = record.description.toLowerCase().split(/[\s,]+/);
        const desc2 = item.description.toLowerCase().split(/[\s,]+/);
        
        const allKeywords1 = [...new Set([...key1, ...desc1])].filter(w => w.length > 3);
        const allKeywords2 = [...new Set([...key2, ...desc2])].filter(w => w.length > 3);
        
        const commonWords = allKeywords1.filter(word => allKeywords2.includes(word));
        
        // Exclude common grammatical words
        const stopWords = ['with', 'that', 'this', 'from', 'where', 'wearing', 'under', 'near', 'some', 'about'];
        const validMatches = commonWords.filter(word => !stopWords.includes(word));

        if (validMatches.length > 0) {
          const bonus = Math.min(30, validMatches.length * 10);
          matchScore += bonus;
          reasons.push(`Matching traits: ${validMatches.join(', ')}`);
        }

        return {
          item,
          matchPercentage: Math.min(100, matchScore),
          reasons
        };
      })
      .filter(match => match.matchPercentage >= 40) // only return items with at least a base animal type match
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  },

  // --- ADOPTIONS ---
  getAdoptions: async function() {
    if (window.GuardianPulse.isDemoMode) {
      return Promise.resolve(this._readLocal("gp_adoptions"));
    } else {
      const snapshot = await window.GuardianPulse.firestore.collection("adoptions").where("status", "==", "Available").get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    }
  },

  submitAdoptionApplication: async function(userId, appData) {
    if (window.GuardianPulse.isDemoMode) {
      const apps = this._readLocal("gp_applications");
      const newApp = {
        id: "app-" + Date.now(),
        userId: userId,
        dateSubmitted: new Date().toISOString(),
        ...appData
      };
      apps.push(newApp);
      this._writeLocal("gp_applications", apps);

      // Create a notification for the user
      this.createNotification(
        userId,
        "Adoption Application Received",
        `Your application to adopt ${appData.animalName} has been received and is under review.`
      );
      
      return Promise.resolve(newApp);
    } else {
      const docRef = window.GuardianPulse.firestore.collection("applications").doc();
      const newApp = {
        id: docRef.id,
        userId: userId,
        dateSubmitted: new Date().toISOString(),
        ...appData
      };
      await docRef.set(newApp);
      
      await this.createNotification(
        userId,
        "Adoption Application Received",
        `Your application to adopt ${appData.animalName} has been received.`
      );
      return newApp;
    }
  },

  getAllAdoptionApplications: async function() {
    if (window.GuardianPulse.isDemoMode) {
      return Promise.resolve(this._readLocal("gp_applications"));
    } else {
      const snapshot = await window.GuardianPulse.firestore.collection("applications").get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    }
  },

  getUserAdoptionApplications: async function(userId) {
    if (window.GuardianPulse.isDemoMode) {
      const apps = this._readLocal("gp_applications");
      return Promise.resolve(apps.filter(app => app.userId === userId));
    } else {
      const snapshot = await window.GuardianPulse.firestore.collection("applications").where("userId", "==", userId).get();
      const list = [];
      snapshot.forEach(doc => list.push(doc.data()));
      return list;
    }
  },

  updateApplicationStatus: async function(appId, newStatus, animalId, applicantId) {
    if (window.GuardianPulse.isDemoMode) {
      const apps = this._readLocal("gp_applications");
      const appIndex = apps.findIndex(a => a.id === appId);
      if (appIndex !== -1) {
        apps[appIndex].status = newStatus;
        this._writeLocal("gp_applications", apps);

        this.createNotification(
          applicantId,
          "Adoption Status Updated",
          `Your application status is now: ${newStatus}.`
        );
      }
      return Promise.resolve();
    } else {
      await window.GuardianPulse.firestore.collection("applications").doc(appId).update({ status: newStatus });
      await this.createNotification(
        applicantId,
        "Adoption Status Updated",
        `Your application status is now: ${newStatus}.`
      );
      return Promise.resolve();
    }
  },

  addAdoptionListing: async function(adoptionData) {
    if (window.GuardianPulse.isDemoMode) {
      const adoptions = this._readLocal("gp_adoptions");
      const newListing = {
        id: "adopt-" + Date.now(),
        dateAdded: new Date().toISOString(),
        ...adoptionData
      };
      adoptions.push(newListing);
      this._writeLocal("gp_adoptions", adoptions);
      return Promise.resolve(newListing);
    } else {
      const docRef = window.GuardianPulse.firestore.collection("adoptions").doc();
      const newListing = {
        id: docRef.id,
        dateAdded: new Date().toISOString(),
        ...adoptionData
      };
      await docRef.set(newListing);
      return newListing;
    }
  }
};

window.GPDB = GPDB;
