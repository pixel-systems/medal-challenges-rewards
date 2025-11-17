// Pagination state
let currentPage = 1;
let isLoading = false;
let hasMore = false;
let activityMap = null; // Leaflet map instance

// Format duration helper
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Render activity card
function renderActivityCard(activity) {
  const card = document.createElement('div');
  card.className = 'activity-card';
  card.setAttribute('data-activity-id', activity._id);
  card.style.cursor = 'pointer';
  
  let detailsHTML = `
    <div class="activity-header">
      <h3>${activity.name || 'Untitled Activity'}</h3>
      <span class="activity-source ${activity.source}">${activity.source}</span>
    </div>
    <div class="activity-details">
      <div class="detail">
        <span class="label">Type:</span>
        <span class="value">${activity.type || 'N/A'}</span>
      </div>
      <div class="detail">
        <span class="label">Date:</span>
        <span class="value">${new Date(activity.startDate).toLocaleDateString()}</span>
      </div>
  `;
  
  if (activity.distance) {
    detailsHTML += `
      <div class="detail">
        <span class="label">Distance:</span>
        <span class="value">${(activity.distance / 1000).toFixed(2)} km</span>
      </div>
    `;
  }
  
  if (activity.movingTime) {
    detailsHTML += `
      <div class="detail">
        <span class="label">Duration:</span>
        <span class="value">${formatDuration(activity.movingTime)}</span>
      </div>
    `;
  }
  
  if (activity.averageSpeed) {
    detailsHTML += `
      <div class="detail">
        <span class="label">Avg Speed:</span>
        <span class="value">${(activity.averageSpeed * 3.6).toFixed(2)} km/h</span>
      </div>
    `;
  }
  
  if (activity.calories) {
    detailsHTML += `
      <div class="detail">
        <span class="label">Calories:</span>
        <span class="value">${activity.calories}</span>
      </div>
    `;
  }
  
  // Add kudos if available
  if (activity.kudosCount !== undefined && activity.kudosCount > 0) {
    detailsHTML += `
      <div class="detail">
        <span class="label">👍 Kudos:</span>
        <span class="value">${activity.kudosCount}</span>
      </div>
    `;
  }
  
  detailsHTML += '</div></div>';
  card.innerHTML = detailsHTML;
  return card;
}

// Load more activities
async function loadMoreActivities() {
  console.log('loadMoreActivities called', { isLoading, hasMore, currentPage });
  
  if (isLoading) {
    console.log('Already loading, skipping...');
    return;
  }
  
  if (!hasMore) {
    console.log('No more activities to load');
    return;
  }
  
  isLoading = true;
  currentPage++;
  
  console.log(`Loading page ${currentPage}...`);
  
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const activitiesList = document.getElementById('activitiesList');
  
  if (!activitiesList) {
    console.error('Activities list element not found');
    isLoading = false;
    return;
  }
  
  if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  if (loadingIndicator) loadingIndicator.style.display = 'block';
  
  try {
    const url = `/activities?page=${currentPage}&format=json`;
    console.log('Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (data.activities && data.activities.length > 0) {
      console.log(`Adding ${data.activities.length} activities to the list`);
      
      data.activities.forEach(activity => {
        const card = renderActivityCard(activity);
        activitiesList.appendChild(card);
      });
      
      hasMore = data.pagination && data.pagination.hasMore;
      console.log('Has more pages:', hasMore);
      
      if (hasMore && loadMoreBtn) {
        loadMoreBtn.style.display = 'block';
      }
    } else {
      console.log('No more activities returned');
      hasMore = false;
    }
    
    // Update pagination info
    if (data.pagination) {
      const paginationInfo = document.querySelector('.pagination-info');
      if (paginationInfo) {
        const currentCount = activitiesList.querySelectorAll('.activity-card').length;
        paginationInfo.innerHTML = `<p>Showing ${currentCount} of ${data.pagination.total} activities</p>`;
      }
    }
  } catch (err) {
    console.error('Error loading more activities:', err);
    alert('Error loading more activities: ' + err.message);
    // Re-enable button on error
    if (loadMoreBtn) loadMoreBtn.style.display = 'block';
    currentPage--; // Revert page increment on error
  } finally {
    isLoading = false;
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (!hasMore && loadMoreBtn) {
      loadMoreBtn.style.display = 'none';
    }
  }
}

// Initialize pagination state from server
function initPagination() {
  const paginationData = document.querySelector('[data-pagination]');
  if (paginationData) {
    try {
      const pagination = JSON.parse(paginationData.dataset.pagination);
      hasMore = pagination.hasMore;
      currentPage = pagination.page;
    } catch (e) {
      console.error('Error parsing pagination data:', e);
    }
  }
}

// Show activity details modal
async function showActivityDetails(activityId) {
  console.log('Loading activity details for:', activityId);
  
  const modal = document.getElementById('activityModal');
  const modalBody = document.getElementById('modalActivityBody');
  const modalName = document.getElementById('modalActivityName');
  const mapContainer = document.getElementById('activityMapContainer');
  
  if (!modal || !modalBody) {
    console.error('Modal elements not found');
    return;
  }
  
      // Hide map container initially
      if (mapContainer) {
        mapContainer.style.display = 'none';
      }
      
      // Hide charts container initially
      const chartsContainer = document.getElementById('activityChartsContainer');
      if (chartsContainer) {
        chartsContainer.style.display = 'none';
      }
      
      // Destroy any existing map
      if (activityMap) {
        activityMap.remove();
        activityMap = null;
      }
      
      // Destroy any existing charts (only if Chart.js is loaded and chart exists)
      if (typeof Chart !== 'undefined') {
        if (window.paceChart && typeof window.paceChart.destroy === 'function') {
          try {
            window.paceChart.destroy();
          } catch (e) {
            console.warn('Error destroying paceChart:', e);
          }
          window.paceChart = null;
        }
        if (window.gapChart && typeof window.gapChart.destroy === 'function') {
          try {
            window.gapChart.destroy();
          } catch (e) {
            console.warn('Error destroying gapChart:', e);
          }
          window.gapChart = null;
        }
        if (window.heartrateChart && typeof window.heartrateChart.destroy === 'function') {
          try {
            window.heartrateChart.destroy();
          } catch (e) {
            console.warn('Error destroying heartrateChart:', e);
          }
          window.heartrateChart = null;
        }
        if (window.cadenceChart && typeof window.cadenceChart.destroy === 'function') {
          try {
            window.cadenceChart.destroy();
          } catch (e) {
            console.warn('Error destroying cadenceChart:', e);
          }
          window.cadenceChart = null;
        }
      }
  
  // Show modal with loading state
  console.log('Showing modal');
  console.log('Modal element:', modal);
  console.log('Modal current display:', window.getComputedStyle(modal).display);
  
  // Remove any hidden classes and set display
  modal.classList.remove('hidden');
  modal.classList.add('modal-visible');
  
  // Set display styles - use setProperty to ensure it's set correctly
  modal.style.setProperty('display', 'block', 'important');
  modal.style.setProperty('visibility', 'visible', 'important');
  modal.style.setProperty('opacity', '1', 'important');
  
  // Double check it's visible
  const computedDisplay = window.getComputedStyle(modal).display;
  console.log('Modal display after setting:', computedDisplay);
  
  if (computedDisplay === 'none') {
    console.error('Modal still hidden! Trying force method...');
    // Force with class and inline style
    modal.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important;');
  }
  
  modalBody.innerHTML = '<div class="loading-spinner">Loading activity details...</div>';
  
  try {
    const response = await fetch(`/activities/${activityId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const activity = data.activity;
    const stravaDetails = data.stravaDetails;
    const stravaLaps = data.stravaLaps;
    const stravaZones = data.stravaZones;
    const stravaComments = data.stravaComments;
    const stravaStream = data.stravaStream;
    
    console.log('Activity details loaded:', activity);
    console.log('Strava data:', {
      hasDetails: !!stravaDetails,
      lapsCount: stravaLaps?.length || 0,
      hasZones: !!stravaZones,
      commentsCount: stravaComments?.length || 0
    });
    
    // Set activity name
    modalName.textContent = activity.name || 'Activity Details';
    
    // Get kudos count
    const kudosCount = stravaDetails?.kudos_count || 0;
    
    // Build details HTML
    let detailsHTML = `
      <div class="activity-detail-section">
        <h3>Basic Information</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Type:</span>
            <span class="detail-value">${activity.type || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Source:</span>
            <span class="detail-value">${activity.source || 'N/A'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Date:</span>
            <span class="detail-value">${new Date(activity.startDate).toLocaleString()}</span>
          </div>
          ${kudosCount > 0 ? `
          <div class="detail-item">
            <span class="detail-label">👍 Kudos:</span>
            <span class="detail-value">${kudosCount}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Distance and time details
    if (activity.distance || activity.movingTime || activity.totalTime) {
      detailsHTML += `
        <div class="activity-detail-section">
          <h3>Distance & Time</h3>
          <div class="detail-grid">
      `;
      
      if (activity.distance) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Distance:</span>
            <span class="detail-value">${(activity.distance / 1000).toFixed(2)} km</span>
          </div>
        `;
      }
      
      if (activity.movingTime) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Moving Time:</span>
            <span class="detail-value">${formatDuration(activity.movingTime)}</span>
          </div>
        `;
      }
      
      if (activity.totalTime) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Total Time:</span>
            <span class="detail-value">${formatDuration(activity.totalTime)}</span>
          </div>
        `;
      }
      
      detailsHTML += `</div></div>`;
    }
    
    // Speed details
    if (activity.averageSpeed || activity.maxSpeed) {
      detailsHTML += `
        <div class="activity-detail-section">
          <h3>Speed</h3>
          <div class="detail-grid">
      `;
      
      if (activity.averageSpeed) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Average Speed:</span>
            <span class="detail-value">${(activity.averageSpeed * 3.6).toFixed(2)} km/h</span>
          </div>
        `;
      }
      
      if (activity.maxSpeed) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Max Speed:</span>
            <span class="detail-value">${(activity.maxSpeed * 3.6).toFixed(2)} km/h</span>
          </div>
        `;
      }
      
      detailsHTML += `</div></div>`;
    }
    
    // Heart rate details
    if (activity.averageHeartrate || activity.maxHeartrate) {
      detailsHTML += `
        <div class="activity-detail-section">
          <h3>Heart Rate</h3>
          <div class="detail-grid">
      `;
      
      if (activity.averageHeartrate) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Average HR:</span>
            <span class="detail-value">${activity.averageHeartrate} bpm</span>
          </div>
        `;
      }
      
      if (activity.maxHeartrate) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Max HR:</span>
            <span class="detail-value">${activity.maxHeartrate} bpm</span>
          </div>
        `;
      }
      
      detailsHTML += `</div></div>`;
    }
    
    // Calories
    if (activity.calories) {
      detailsHTML += `
        <div class="activity-detail-section">
          <h3>Calories</h3>
          <div class="detail-item">
            <span class="detail-label">Calories Burned:</span>
            <span class="detail-value">${activity.calories}</span>
          </div>
        </div>
      `;
    }
    
    // Strava additional details
    if (stravaDetails) {
      detailsHTML += `
        <div class="activity-detail-section">
          <h3>Additional Strava Details</h3>
          <div class="detail-grid">
      `;
      
      if (stravaDetails.description) {
        detailsHTML += `
          <div class="detail-item full-width">
            <span class="detail-label">Description:</span>
            <span class="detail-value">${stravaDetails.description}</span>
          </div>
        `;
      }
      
      if (stravaDetails.elev_high || stravaDetails.elev_low) {
        if (stravaDetails.elev_high) {
          detailsHTML += `
            <div class="detail-item">
              <span class="detail-label">Elevation High:</span>
              <span class="detail-value">${stravaDetails.elev_high} m</span>
            </div>
          `;
        }
        if (stravaDetails.elev_low) {
          detailsHTML += `
            <div class="detail-item">
              <span class="detail-label">Elevation Low:</span>
              <span class="detail-value">${stravaDetails.elev_low} m</span>
            </div>
          `;
        }
      }
      
      if (stravaDetails.total_elevation_gain) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Total Elevation Gain:</span>
            <span class="detail-value">${stravaDetails.total_elevation_gain} m</span>
          </div>
        `;
      }
      
      if (stravaDetails.kilojoules) {
        detailsHTML += `
          <div class="detail-item">
            <span class="detail-label">Energy:</span>
            <span class="detail-value">${stravaDetails.kilojoules} kJ</span>
          </div>
        `;
      }
      
      detailsHTML += `</div></div>`;
    }
    
    // Add accordion sections for laps, zones, and comments
    detailsHTML += `
      <div class="accordion-section">
        <div class="accordion-item">
          <div class="accordion-header" data-accordion="laps">
            <h3>🏃 Laps ${stravaLaps && stravaLaps.length > 0 ? `(${stravaLaps.length})` : ''}</h3>
            <span class="accordion-icon">▼</span>
          </div>
          <div class="accordion-content">
            ${stravaLaps && stravaLaps.length > 0 ? renderLaps(stravaLaps) : '<p class="no-data">No lap data available</p>'}
          </div>
        </div>
        
        <div class="accordion-item">
          <div class="accordion-header" data-accordion="zones">
            <h3>📊 Zones ${stravaZones ? '(Available)' : ''}</h3>
            <span class="accordion-icon">▼</span>
          </div>
          <div class="accordion-content">
            ${stravaZones ? renderZones(stravaZones) : '<p class="no-data">No zone data available</p>'}
          </div>
        </div>
        
        <div class="accordion-item">
          <div class="accordion-header" data-accordion="comments">
            <h3>💬 Comments ${stravaComments && stravaComments.length > 0 ? `(${stravaComments.length})` : ''}</h3>
            <span class="accordion-icon">▼</span>
          </div>
          <div class="accordion-content">
            ${stravaComments && stravaComments.length > 0 ? renderComments(stravaComments) : '<p class="no-data">No comments</p>'}
          </div>
        </div>
      </div>
    `;
    
    modalBody.innerHTML = detailsHTML;
    
    // Set up accordion event listeners after content is inserted
    setupAccordionListeners();
    
    // Display charts if stream data is available
    if (stravaStream) {
      console.log('Stream data available, rendering charts');
      displayActivityCharts(stravaStream);
    }
    
    // Display map if polyline is available
    // Check multiple possible locations for polyline data
    let mapData = null;
    if (stravaDetails) {
      console.log('Strava details available:', {
        hasMap: !!stravaDetails.map,
        mapPolyline: !!stravaDetails.map?.polyline,
        mapSummaryPolyline: !!stravaDetails.map?.summary_polyline,
        summaryPolyline: !!stravaDetails.summary_polyline
      });
      
      if (stravaDetails.map) {
        mapData = stravaDetails.map;
      } else if (stravaDetails.summary_polyline) {
        // Some activities might have summary_polyline at root level
        mapData = { summary_polyline: stravaDetails.summary_polyline };
      }
    }
    
    if (mapData && (mapData.polyline || mapData.summary_polyline)) {
      console.log('Map data found, displaying map');
      displayActivityMap(mapData);
    } else {
      console.log('No map data available for this activity');
    }
    
  } catch (err) {
    console.error('Error loading activity details:', err);
    modalBody.innerHTML = `
      <div class="error-message">
        <p>Error loading activity details: ${err.message}</p>
        <button class="btn btn-primary" onclick="document.getElementById('activityModal').style.display='none'">Close</button>
      </div>
    `;
  }
}

// Format pace (min:sec per km)
function formatPace(seconds, distanceMeters) {
  if (!seconds || !distanceMeters || distanceMeters === 0) return 'N/A';
  const paceSecondsPerKm = (seconds / distanceMeters) * 1000;
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const secs = Math.floor(paceSecondsPerKm % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')} min/km`;
}

// Render laps
function renderLaps(laps) {
  console.log('Rendering laps:', laps);
  if (!laps || laps.length === 0) {
    console.log('No laps data');
    return '<p class="no-data">No laps available</p>';
  }
  
  let html = '<div class="laps-table-container"><table class="laps-table"><thead><tr>';
  html += '<th>Lap</th>';
  html += '<th>Distance</th>';
  html += '<th>Time</th>';
  html += '<th>Pace</th>';
  html += '<th>Avg Speed</th>';
  html += '<th>Max Speed</th>';
  html += '<th>Average HR</th>';
  html += '<th>Max HR</th>';
  html += '</tr></thead><tbody>';
  
  laps.forEach((lap, index) => {
    console.log(`Rendering lap ${index + 1}:`, lap);
    const lapNumber = index + 1;
    const distance = lap.distance ? `${(lap.distance / 1000).toFixed(2)} km` : 'N/A';
    const time = lap.moving_time ? formatDuration(lap.moving_time) : 'N/A';
    const pace = (lap.moving_time && lap.distance) ? formatPace(lap.moving_time, lap.distance) : 'N/A';
    const avgSpeed = lap.average_speed ? `${(lap.average_speed * 3.6).toFixed(2)} km/h` : 'N/A';
    const maxSpeed = lap.max_speed ? `${(lap.max_speed * 3.6).toFixed(2)} km/h` : 'N/A';
    const avgHR = lap.average_heartrate ? `${lap.average_heartrate} bpm` : 'N/A';
    const maxHR = lap.max_heartrate ? `${lap.max_heartrate} bpm` : 'N/A';
    
    html += '<tr>';
    html += `<td>${lapNumber}</td>`;
    html += `<td>${distance}</td>`;
    html += `<td>${time}</td>`;
    html += `<td>${pace}</td>`;
    html += `<td>${avgSpeed}</td>`;
    html += `<td>${maxSpeed}</td>`;
    html += `<td>${avgHR}</td>`;
    html += `<td>${maxHR}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  console.log('Laps HTML generated, length:', html.length);
  return html;
}

// Render zones
function renderZones(zones) {
  console.log('Rendering zones:', zones);
  if (!zones) {
    console.log('No zones data');
    return '<p class="no-data">No zone data available</p>';
  }
  
  let html = '<div class="zones-display">';
  
  if (zones.distribution_buckets && Array.isArray(zones.distribution_buckets)) {
    const total = zones.distribution_buckets.reduce((a, b) => a + (b || 0), 0);
    html += '<div class="zone-distribution"><h4>Zone Distribution</h4><div class="zone-buckets">';
    zones.distribution_buckets.forEach((bucket, index) => {
      const percentage = total > 0 ? ((bucket || 0) / total * 100).toFixed(1) : 0;
      html += `
        <div class="zone-bucket">
          <div class="zone-bucket-label">Zone ${index + 1}</div>
          <div class="zone-bucket-bar">
            <div class="zone-bucket-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="zone-bucket-value">${percentage}%</div>
        </div>
      `;
    });
    html += '</div></div>';
  }
  
  if (zones.type === 'heartrate' && zones.score !== undefined) {
    html += `<div class="zone-score"><span class="label">Zone Score:</span> <span class="value">${zones.score}</span></div>`;
  }
  
  if (zones.type === 'power' && zones.score !== undefined) {
    html += `<div class="zone-score"><span class="label">Power Zone Score:</span> <span class="value">${zones.score}</span></div>`;
  }
  
  html += '</div>';
  console.log('Zones HTML generated, length:', html.length);
  return html;
}

// Render comments
function renderComments(comments) {
  console.log('Rendering comments:', comments);
  if (!comments || comments.length === 0) {
    console.log('No comments data');
    return '<p class="no-data">No comments</p>';
  }
  
  let html = '<div class="comments-list">';
  comments.forEach((comment, index) => {
    console.log(`Rendering comment ${index + 1}:`, comment);
    const athleteName = comment.athlete ? 
      `${escapeHtml(comment.athlete.firstname || '')} ${escapeHtml(comment.athlete.lastname || '')}`.trim() : 
      'Anonymous';
    const avatarUrl = comment.athlete?.profile || '';
    const commentText = escapeHtml(comment.text || '');
    const commentDate = comment.created_at ? new Date(comment.created_at).toLocaleString() : '';
    
    html += `
      <div class="comment-item">
        <div class="comment-author">
          ${avatarUrl ? `<img src="${avatarUrl}" alt="${athleteName}" class="comment-avatar" onerror="this.style.display='none'">` : ''}
          <div class="comment-author-info">
            <strong>${athleteName}</strong>
            ${commentDate ? `<span class="comment-date">${commentDate}</span>` : ''}
          </div>
        </div>
        <div class="comment-text">${commentText}</div>
      </div>
    `;
  });
  html += '</div>';
  console.log('Comments HTML generated, length:', html.length);
  return html;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup accordion event listeners
function setupAccordionListeners() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  console.log('Setting up accordion listeners, found', accordionHeaders.length, 'headers');
  
  accordionHeaders.forEach((header, index) => {
    console.log(`Setting up listener for header ${index + 1}`);
    // Add click listener
    header.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Accordion header clicked', index);
      toggleAccordion(this);
    });
    
    // Ensure initial state
    const item = header.parentElement;
    const content = item.querySelector('.accordion-content');
    if (content) {
      content.style.display = 'none';
      content.style.maxHeight = '0';
      content.style.padding = '0 1.5rem';
    }
  });
}

// Toggle accordion
function toggleAccordion(header) {
  console.log('toggleAccordion called');
  const item = header.parentElement;
  const content = item.querySelector('.accordion-content');
  const icon = header.querySelector('.accordion-icon');
  
  if (!content || !icon) {
    console.error('Accordion elements not found', { content: !!content, icon: !!icon });
    return;
  }
  
  const isActive = item.classList.contains('active');
  console.log('Accordion state:', isActive ? 'active' : 'inactive');
  
  if (isActive) {
    // Close
    content.style.display = 'none';
    content.style.maxHeight = '0';
    content.style.padding = '0 1.5rem';
    icon.textContent = '▼';
    item.classList.remove('active');
  } else {
    // Open
    content.style.display = 'block';
    content.style.maxHeight = '2000px';
    content.style.padding = '1.5rem';
    icon.textContent = '▲';
    item.classList.add('active');
  }
}

// Decode polyline (Google's polyline encoding algorithm)
function decodePolyline(encoded) {
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    poly.push([lat * 1e-5, lng * 1e-5]);
  }
  return poly;
}

// Display activity map
function displayActivityMap(mapData) {
  console.log('Displaying activity map', mapData);
  
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded');
    return;
  }
  
  const mapContainer = document.getElementById('activityMapContainer');
  const mapDiv = document.getElementById('activityMap');
  
  if (!mapContainer || !mapDiv) {
    console.error('Map container not found', { mapContainer: !!mapContainer, mapDiv: !!mapDiv });
    return;
  }
  
  // Show map container
  mapContainer.style.display = 'block';
  console.log('Map container shown');
  
  // Destroy existing map if it exists
  if (activityMap) {
    console.log('Removing existing map');
    activityMap.remove();
    activityMap = null;
  }
  
  try {
    // Decode polyline
    let coordinates = [];
    let polylineString = null;
    
    if (mapData.polyline) {
      polylineString = mapData.polyline;
      console.log('Using polyline (full resolution)');
    } else if (mapData.summary_polyline) {
      polylineString = mapData.summary_polyline;
      console.log('Using summary_polyline');
    }
    
    if (!polylineString) {
      console.warn('No polyline data found in mapData:', mapData);
      mapContainer.style.display = 'none';
      return;
    }
    
    console.log('Decoding polyline, length:', polylineString.length);
    coordinates = decodePolyline(polylineString);
    console.log('Decoded coordinates count:', coordinates.length);
    
    if (coordinates.length === 0) {
      console.warn('Polyline decoded to empty array');
      mapContainer.style.display = 'none';
      return;
    }
    
    // Calculate center and bounds
    const center = coordinates[Math.floor(coordinates.length / 2)];
    const bounds = coordinates.reduce((acc, coord) => {
      return [
        [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
        [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
      ];
    }, [[coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]]);
    
    // Clear any existing content in map div
    mapDiv.innerHTML = '';
    
    // Initialize map
    console.log('Initializing Leaflet map at center:', center);
    activityMap = L.map('activityMap', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(center, 13);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(activityMap);
    
    console.log('Map initialized, adding polyline...');
    
    // Add polyline to map
    const polyline = L.polyline(coordinates, {
      color: '#fc4c02',
      weight: 4,
      opacity: 0.8
    }).addTo(activityMap);
    
    // Fit map to polyline bounds
    activityMap.fitBounds(bounds, { padding: [20, 20] });
    
    // Add start and end markers
    if (coordinates.length > 0) {
      const startIcon = L.divIcon({
        className: 'map-marker start-marker',
        html: '<div style="background-color: #4CAF50; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      const endIcon = L.divIcon({
        className: 'map-marker end-marker',
        html: '<div style="background-color: #f44336; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      L.marker(coordinates[0], { icon: startIcon }).addTo(activityMap)
        .bindPopup('Start');
      
      L.marker(coordinates[coordinates.length - 1], { icon: endIcon }).addTo(activityMap)
        .bindPopup('End');
    }
    
    // Invalidate map size after modal is fully shown
    setTimeout(() => {
      if (activityMap) {
        console.log('Invalidating map size');
        activityMap.invalidateSize();
        // Fit bounds again after size is corrected
        activityMap.fitBounds(bounds, { padding: [20, 20] });
      }
    }, 300);
    
    console.log('Map displayed successfully with', coordinates.length, 'coordinates');
  } catch (err) {
    console.error('Error displaying map:', err);
    mapContainer.style.display = 'none';
  }
}

// Display activity charts
function displayActivityCharts(streamData) {
  console.log('Displaying activity charts', streamData);
  
  const chartsContainer = document.getElementById('activityChartsContainer');
  if (!chartsContainer) {
    console.error('Charts container not found');
    return;
  }
  
  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library not loaded');
    return;
  }
  
  // Show charts container
  chartsContainer.style.display = 'block';
  
  // Destroy existing charts if they exist (with proper checks)
  if (window.paceChart && typeof window.paceChart.destroy === 'function') {
    try {
      window.paceChart.destroy();
    } catch (e) {
      console.warn('Error destroying paceChart:', e);
    }
    window.paceChart = null;
  }
  if (window.gapChart && typeof window.gapChart.destroy === 'function') {
    try {
      window.gapChart.destroy();
    } catch (e) {
      console.warn('Error destroying gapChart:', e);
    }
    window.gapChart = null;
  }
  if (window.heartrateChart && typeof window.heartrateChart.destroy === 'function') {
    try {
      window.heartrateChart.destroy();
    } catch (e) {
      console.warn('Error destroying heartrateChart:', e);
    }
    window.heartrateChart = null;
  }
  if (window.cadenceChart && typeof window.cadenceChart.destroy === 'function') {
    try {
      window.cadenceChart.destroy();
    } catch (e) {
      console.warn('Error destroying cadenceChart:', e);
    }
    window.cadenceChart = null;
  }
  
  // Extract data from stream
  const distance = streamData.distance?.data || [];
  const altitude = streamData.altitude?.data || [];
  const heartrate = streamData.heartrate?.data || [];
  const cadence = streamData.cadence?.data || [];
  const velocity = streamData.velocity_smooth?.data || []; // m/s
  const grade = streamData.grade_smooth?.data || [];
  
  if (distance.length === 0) {
    console.warn('No distance data in stream');
    return;
  }
  
  // Convert distance from meters to kilometers
  const distanceKm = distance.map(d => (d / 1000).toFixed(2));
  
  // Calculate pace (minutes per km) from velocity
  const pace = velocity.map(v => {
    if (!v || v === 0) return null;
    return (1000 / v) / 60; // Convert to minutes per km
  });
  
  // Calculate GAP (Grade Adjusted Pace)
  const gap = velocity.map((v, i) => {
    if (!v || v === 0) return null;
    const currentGrade = grade[i] || 0;
    const gradeAdjustment = 1 + (currentGrade / 100) * 0.1;
    return ((1000 / v) / 60) * gradeAdjustment;
  });
  
  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        enabled: true,
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Distance (km)'
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        type: 'linear',
        position: 'left',
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Elevation (m)'
        },
        grid: {
          drawOnChartArea: false,
        }
      }
    }
  };
  
  // Pace Chart
  const paceCtx = document.getElementById('paceChart');
  if (paceCtx) {
    window.paceChart = new Chart(paceCtx, {
      type: 'line',
      data: {
        labels: distanceKm,
        datasets: [
          {
            label: 'Pace (min/km)',
            data: pace,
            borderColor: 'rgb(102, 126, 234)',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            yAxisID: 'y',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Elevation (m)',
            data: altitude,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y1',
            tension: 0.4,
            fill: false
          }
        ]
      },
      options: {
        ...chartOptions,
        scales: {
          ...chartOptions.scales,
          y: {
            ...chartOptions.scales.y,
            title: {
              display: true,
              text: 'Pace (min/km)'
            }
          }
        }
      }
    });
  }
  
  // GAP Chart
  const gapCtx = document.getElementById('gapChart');
  if (gapCtx) {
    window.gapChart = new Chart(gapCtx, {
      type: 'line',
      data: {
        labels: distanceKm,
        datasets: [
          {
            label: 'GAP (min/km)',
            data: gap,
            borderColor: 'rgb(118, 75, 162)',
            backgroundColor: 'rgba(118, 75, 162, 0.1)',
            yAxisID: 'y',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Elevation (m)',
            data: altitude,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y1',
            tension: 0.4,
            fill: false
          }
        ]
      },
      options: {
        ...chartOptions,
        scales: {
          ...chartOptions.scales,
          y: {
            ...chartOptions.scales.y,
            title: {
              display: true,
              text: 'GAP (min/km)'
            }
          }
        }
      }
    });
  }
  
  // Heart Rate Chart
  const hrCtx = document.getElementById('heartrateChart');
  if (hrCtx && heartrate.length > 0) {
    window.heartrateChart = new Chart(hrCtx, {
      type: 'line',
      data: {
        labels: distanceKm,
        datasets: [
          {
            label: 'Heart Rate (bpm)',
            data: heartrate,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Elevation (m)',
            data: altitude,
            borderColor: 'rgb(102, 126, 234)',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            yAxisID: 'y1',
            tension: 0.4,
            fill: false
          }
        ]
      },
      options: {
        ...chartOptions,
        scales: {
          ...chartOptions.scales,
          y: {
            ...chartOptions.scales.y,
            title: {
              display: true,
              text: 'Heart Rate (bpm)'
            }
          }
        }
      }
    });
  }
  
  // Cadence Chart
  const cadenceCtx = document.getElementById('cadenceChart');
  if (cadenceCtx && cadence.length > 0) {
    window.cadenceChart = new Chart(cadenceCtx, {
      type: 'line',
      data: {
        labels: distanceKm,
        datasets: [
          {
            label: 'Cadence (rpm)',
            data: cadence,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            yAxisID: 'y',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Elevation (m)',
            data: altitude,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y1',
            tension: 0.4,
            fill: false
          }
        ]
      },
      options: {
        ...chartOptions,
        scales: {
          ...chartOptions.scales,
          y: {
            ...chartOptions.scales.y,
            title: {
              display: true,
              text: 'Cadence (rpm)'
            }
          }
        }
      }
    });
  }
  
  console.log('Charts rendered successfully');
}

// Close modal
function closeActivityModal() {
  const modal = document.getElementById('activityModal');
  if (modal) {
    modal.classList.remove('modal-visible');
    modal.style.display = 'none';
  }
  
  // Destroy map when modal closes
  if (activityMap) {
    activityMap.remove();
    activityMap = null;
  }
  
  // Destroy charts when modal closes (only if Chart.js is loaded)
  if (typeof Chart !== 'undefined') {
    if (window.paceChart && typeof window.paceChart.destroy === 'function') {
      try {
        window.paceChart.destroy();
      } catch (e) {
        console.warn('Error destroying paceChart:', e);
      }
      window.paceChart = null;
    }
    if (window.gapChart && typeof window.gapChart.destroy === 'function') {
      try {
        window.gapChart.destroy();
      } catch (e) {
        console.warn('Error destroying gapChart:', e);
      }
      window.gapChart = null;
    }
    if (window.heartrateChart && typeof window.heartrateChart.destroy === 'function') {
      try {
        window.heartrateChart.destroy();
      } catch (e) {
        console.warn('Error destroying heartrateChart:', e);
      }
      window.heartrateChart = null;
    }
    if (window.cadenceChart && typeof window.cadenceChart.destroy === 'function') {
      try {
        window.cadenceChart.destroy();
      } catch (e) {
        console.warn('Error destroying cadenceChart:', e);
      }
      window.cadenceChart = null;
    }
  }
  
  // Hide map container
  const mapContainer = document.getElementById('activityMapContainer');
  if (mapContainer) {
    mapContainer.style.display = 'none';
  }
  
  // Hide charts container
  const chartsContainer = document.getElementById('activityChartsContainer');
  if (chartsContainer) {
    chartsContainer.style.display = 'none';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('Activities page script loaded');
  
  initPagination();
  console.log('Pagination initialized:', { currentPage, hasMore });
  
  // Set up event listener for Load More button
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    console.log('Load More button found, attaching event listener');
    loadMoreBtn.addEventListener('click', function(event) {
      console.log('Load More button clicked');
      event.preventDefault();
      loadMoreActivities();
    });
  } else {
    console.warn('Load More button not found in DOM');
  }
  
  // Set up click handlers for activity cards
  const activitiesList = document.getElementById('activitiesList');
  if (activitiesList) {
    console.log('Setting up click handler for activities list');
    activitiesList.addEventListener('click', function(event) {
      console.log('Click detected on activities list', event.target);
      const activityCard = event.target.closest('.activity-card');
      if (activityCard) {
        const activityId = activityCard.getAttribute('data-activity-id');
        console.log('Activity card clicked, ID:', activityId);
        if (activityId) {
          event.preventDefault();
          event.stopPropagation();
          showActivityDetails(activityId);
        } else {
          console.warn('Activity card clicked but no ID found');
        }
      }
    });
  } else {
    console.error('Activities list element not found!');
  }
  
  // Set up modal close handlers
  const modal = document.getElementById('activityModal');
  if (modal) {
    console.log('Modal element found, setting up close handlers');
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeActivityModal);
      console.log('Close button handler attached');
    } else {
      console.warn('Close button not found in modal');
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(event) {
      if (event.target === modal) {
        closeActivityModal();
      }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && modal.style.display === 'block') {
        closeActivityModal();
      }
    });
  } else {
    console.error('Modal element not found in DOM!');
  }
  
  // Set up infinite scroll (optional - uncomment to enable)
  // window.addEventListener('scroll', () => {
  //   if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
  //     loadMoreActivities();
  //   }
  // });
});
