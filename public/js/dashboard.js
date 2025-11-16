function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

async function syncStrava() {
  try {
    const response = await fetch('/activities/sync/strava', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.success) {
      showToast(`Synced ${data.synced} new activities (${data.skipped} already existed)`, 'success');
      setTimeout(() => {
        window.location.href = '/activities';
      }, 2000);
    } else {
      showToast('Error syncing activities', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Error syncing activities', 'error');
  }
}

async function syncGarmin() {
  showToast('Garmin sync is not yet implemented', 'error');
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
