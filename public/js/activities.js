// Load activity types for the filter
async function loadActivityTypes() {
  try {
    const response = await fetch('/activities/types');
    const types = await response.json();
    
    const typeSelect = document.getElementById('type');
    const selectedType = typeSelect.dataset.selected || '';
    
    types.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      if (type === selectedType) {
        option.selected = true;
      }
      typeSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading activity types:', err);
  }
}

// Check if there's a selected type from the URL
const urlParams = new URLSearchParams(window.location.search);
const selectedType = urlParams.get('type');
if (selectedType) {
  document.getElementById('type').dataset.selected = selectedType;
}

// Load activity types on page load
loadActivityTypes();
