const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSSHnLkXFa1HHRnOKt2EXExVNbDlNX9tqUSRIolZyldZd58Q69x0Pz5to0riTTrZyQ1sQHzypTmHf5e/pub?output=csv';

// Store data globally to allow the Search Bar to work
let MASTER_DATA = [];

const ZONE_ORDER = {
    "CENTRAL": 1,
    "NORTH": 2,
    "NORTHWEST": 3,
    "SOUTHWEST": 4,
    "SOUTH": 5,
    "SOUTHEAST": 6
};

async function init() {
    try {
        const response = await fetch(SHEET_URL);
        const csvData = await response.text();
        
        // 1. Split into lines and filter out empty lines
        const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");

        if (lines.length >= 2) {
            // 2. Use a helper to properly parse CSV rows (handles quotes and commas)
            const parseCSVRow = (row) => {
                const result = [];
                let startValueIndex = 0;
                let inQuotes = false;

                for (let i = 0; i < row.length; i++) {
                    if (row[i] === '"') inQuotes = !inQuotes;
                    if (row[i] === ',' && !inQuotes) {
                        result.push(row.substring(startValueIndex, i).replace(/^"|"$/g, '').trim());
                        startValueIndex = i + 1;
                    }
                }
                result.push(row.substring(startValueIndex).replace(/^"|"$/g, '').trim());
                return result;
            };

            const headerRow = parseCSVRow(lines[0]);
            const secondRow = parseCSVRow(lines[1]);

            // 3. Extract and verify index 4 exists
            const hijri = headerRow[4] || "Unknown Hijri";
            const date = secondRow[4] || "Unknown Date";

            // 4. Update UI
            document.getElementById('current-date').innerText = `${hijri} - ${date}`;
        } else {
            console.error("CSV data does not contain enough rows.");
        }

        // 2. Parse CSV and save to Master List
        MASTER_DATA = parseCSV(csvData);
        
        // 3. Initial Render
        renderSchedule(MASTER_DATA);

        // 4. Setup Search Listener
        const searchInput = document.getElementById('masjid-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                
                const filtered = MASTER_DATA.filter(item => 
                    item.name.toLowerCase().includes(searchTerm) || 
                    item.address.toLowerCase().includes(searchTerm) ||
                    item.zone.toLowerCase().includes(searchTerm) ||
                    item.khateeb.toLowerCase().includes(searchTerm) // Added Khateeb search
                );
                
                renderSchedule(filtered);
            });
        }

    } catch (error) {
        console.error("Error:", error);
        document.getElementById('schedule-container').innerHTML = "<p>Error loading schedule. Please check the console.</p>";
    }
}

function parseCSV(csv) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const nextChar = csv[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            currentCell += '"'; i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';
            }
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }

    return rows.slice(1).map(cols => {
        const rawNameAddress = cols[1] || "";
        const parts = rawNameAddress.split(/\r?\n|\n/);
        
        // Inside the .map() part of parseCSV
        return {
            zone:    cols[0] || "OTHER",
            name:    parts[0] || "Unknown",
            address: parts.slice(1).join(', ') || "",
            khut:    cols[2] || "",
            time:    cols[3] || "TBA",
            khateeb: cols[4] || "TBA",
            // Creates a searchable maps link based on the name and address
            mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts[0] + ' ' + parts.slice(1).join(', '))}`
        };
    }).filter(row => row.name && row.name !== "Unknown");
}

function renderSchedule(data) {
    const container = document.getElementById('schedule-container');
    container.innerHTML = "";

    // If search results are empty
    if (data.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding: 20px;'>No Masjids found matching your search.</p>";
        return;
    }

    // Sort by Zone Priority, then by Masjid Name
    data.sort((a, b) => {
        const valA = ZONE_ORDER[a.zone.toUpperCase()] || 99;
        const valB = ZONE_ORDER[b.zone.toUpperCase()] || 99;
        if (valA !== valB) return valA - valB;
        return a.name.localeCompare(b.name);
    });

    const zones = [...new Set(data.map(item => item.zone))].filter(z => z);

    zones.forEach(zoneName => {
        const zoneSection = document.createElement('section');
        zoneSection.className = 'region-group';
        
        const zoneMasjids = data.filter(item => item.zone === zoneName);
        const grouped = zoneMasjids.reduce((acc, curr) => {
            if (!acc[curr.name]) acc[curr.name] = [];
            acc[curr.name].push(curr);
            return acc;
        }, {});

        let masjidHTML = '';
        for (const name in grouped) {
            const firstEntry = grouped[name][0];
            masjidHTML += `
                <div class="masjid-card">
                    <div class="masjid-info">
                        <div class="masjid-name"><strong>${name}</strong></div>
                        <div class="masjid-address">
                            <a href="${firstEntry.mapUrl}" target="_blank" rel="noopener noreferrer">
                                ${firstEntry.address}
                            </div>
                        </a>
                    </div>
                    ${grouped[name].map(slot => `
                        <div class="khutbah-slot">
                            <div class="time-block">
                                <span class="khut-label">${slot.khut}</span> 
                                <span class="time">${slot.time}</span>
                            </div>
                            <span class="khateeb">${slot.khateeb}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        zoneSection.innerHTML = `
            <h2 class="region-title">${zoneName}</h2>
            <div class="masjid-grid">${masjidHTML}</div>
        `;
        container.appendChild(zoneSection);
    });
}

init();