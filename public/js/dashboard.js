function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// Strava sync function
async function syncStrava(event) {
  console.log('syncStrava called', event);
  
  // Get button element - handle both event and direct call
  let button;
  if (event && event.target) {
    button = event.target;
  } else {
    button = document.getElementById('syncStravaBtn');
    if (!button) {
      button = document.querySelector('button[onclick*="syncStrava"]');
    }
  }
  
  if (!button) {
    console.error('Sync button not found');
    showToast('Error: Sync button not found', 'error');
    return;
  }
  
  console.log('Sync button found, starting sync...');
  
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Syncing...';
  
  try {
    let page = 1;
    let totalSynced = 0;
    let totalSkipped = 0;
    let hasMore = true;
    let maxPages = 10; // Safety limit to prevent infinite loops

    while (hasMore && page <= maxPages) {
      console.log(`Syncing page ${page}...`);
      
      const response = await fetch('/activities/sync/strava', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          page, 
          per_page: 200  // Use Strava's max per_page for efficiency
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('Sync response:', data);

      if (data.success) {
        totalSynced += data.synced;
        totalSkipped += data.skipped;
        
        // Update button text to show progress
        button.textContent = `Syncing... (${totalSynced} synced)`;
        
        // Check if we should continue based on Strava API pagination
        // If we got fewer activities than per_page, we've reached the end
        if (data.total < data.perPage) {
          // Got less than a full page, no more activities
          hasMore = false;
        } else if (data.synced === 0 && data.skipped > 0) {
          // All activities on this page already exist, but might be more pages
          // Continue to next page if hasMore is true
          if (data.hasMore) {
            page++;
          } else {
            hasMore = false;
          }
        } else if (data.hasMore) {
          // More pages available
          page++;
        } else {
          // No more pages
          hasMore = false;
        }
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    }

    if (page > maxPages) {
      showToast(`Synced ${totalSynced} activities (stopped at page limit)`, 'success');
    } else {
      showToast(`Synced ${totalSynced} new activities (${totalSkipped} already existed)`, 'success');
    }
    
    setTimeout(() => {
      window.location.href = '/activities';
    }, 2000);
  } catch (err) {
    console.error('Sync error:', err);
    showToast('Error syncing activities: ' + (err.message || 'Unknown error'), 'error');
    button.disabled = false;
    button.textContent = originalText;
  }
}

// Set up event listener for sync button
document.addEventListener('DOMContentLoaded', function() {
  console.log('Dashboard script loaded');
  
  // Set up sync button on dashboard
  const syncButton = document.getElementById('syncStravaBtn');
  if (syncButton) {
    console.log('Sync button found, attaching event listener');
    syncButton.addEventListener('click', function(event) {
      console.log('Sync button clicked');
      event.preventDefault();
      syncStrava(event);
    });
  }
  
  // Set up sync button on profile page
  const syncButtonProfile = document.getElementById('syncStravaBtnProfile');
  if (syncButtonProfile) {
    console.log('Sync button (profile) found, attaching event listener');
    syncButtonProfile.addEventListener('click', function(event) {
      console.log('Sync button (profile) clicked');
      event.preventDefault();
      syncStrava(event);
    });
  }
  
  // Check URL parameters for messages
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('strava') === 'connected') {
    showToast('Strava connected successfully!', 'success');
  } else if (urlParams.get('strava') === 'disconnected') {
    showToast('Strava disconnected', 'success');
  } else if (urlParams.get('error')) {
    showToast('An error occurred', 'error');
  }
});
