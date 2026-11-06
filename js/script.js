// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const getImagesButton = document.querySelector('.filters button');
const gallery = document.getElementById('gallery');
const apodUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';

// Choose one space fact when the page loads.
const spaceFacts = [
	'Neutron stars can spin hundreds of times every second.',
	'One day on Venus is longer than one year on Venus.',
	'The footprints left by Apollo astronauts can last for millions of years.',
	'Jupiter has faint rings made mostly of dust.'
];
const factSection = document.createElement('section');
factSection.className = 'space-fact';
factSection.setAttribute('aria-labelledby', 'space-fact-title');

const factTitle = document.createElement('h2');
factTitle.id = 'space-fact-title';
factTitle.textContent = 'Did You Know?';

const factText = document.createElement('p');
factText.textContent = spaceFacts[Math.floor(Math.random() * spaceFacts.length)];

factSection.append(factTitle, factText);
gallery.before(factSection);

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// Create the image details window once so it can be reused for every photo.
const imageModal = document.createElement('dialog');
imageModal.className = 'image-modal';
imageModal.setAttribute('aria-label', 'Space photo details');
document.body.append(imageModal);

// Check the selected range before requesting data.
function datesAreValid() {
	return startInput.value &&
		endInput.value &&
		startInput.validity.valid &&
		endInput.validity.valid &&
		startInput.value <= endInput.value;
}

// Display a simple status or error message in the gallery.
function showMessage(message) {
	gallery.replaceChildren();
	const messageElement = document.createElement('p');
	messageElement.className = 'gallery-message';
	messageElement.textContent = message;
	gallery.append(messageElement);
}

// Get all image entries between the selected dates from the paged endpoint.
async function getApodPhotos(startDate, endDate) {
	const photos = [];
	let page = 1;
	let keepLoadingPages = true;

	while (keepLoadingPages) {
		const requestUrl = new URL(apodUrl);
		requestUrl.searchParams.set('start_date', startDate);
		requestUrl.searchParams.set('end_date', endDate);
		requestUrl.searchParams.set('per_page', '100');
		requestUrl.searchParams.set('page', page);

		const response = await fetch(requestUrl);
		if (!response.ok) {
			throw new Error('The NASA photo request failed. Please try again.');
		}

		const pagePhotos = await response.json();
		if (!Array.isArray(pagePhotos)) {
			throw new Error('NASA returned an unexpected response. Please try again.');
		}

		pagePhotos.forEach((photo) => {
			if (photo.date >= startDate && photo.date <= endDate) {
				photos.push(photo);
			}
		});

		const oldestDateOnPage = pagePhotos[pagePhotos.length - 1]?.date;
		const totalPages = Number(response.headers.get('X-WP-TotalPages')) || page;
		keepLoadingPages = pagePhotos.length > 0 &&
			oldestDateOnPage >= startDate &&
			page < totalPages;
		page += 1;
	}

	return photos;
}

// Turn NASA's explanation HTML into plain text before adding it to the page.
function getExplanationText(explanation) {
	const explanationDocument = new DOMParser().parseFromString(explanation || '', 'text/html');
	return explanationDocument.body.textContent.trim().replace(/\s+/g, ' ');
}

// Show the larger photo and its details in the modal.
function openImageModal(photo) {
	imageModal.replaceChildren();

	const closeButton = document.createElement('button');
	closeButton.className = 'modal-close';
	closeButton.type = 'button';
	closeButton.textContent = 'Close';
	closeButton.setAttribute('aria-label', 'Close photo details');
	closeButton.addEventListener('click', () => imageModal.close());

	const image = document.createElement('img');
	image.className = 'modal-image';
	image.src = photo.hdurl;
	image.alt = photo.title;

	const details = document.createElement('div');
	details.className = 'modal-details';

	const title = document.createElement('h2');
	title.textContent = photo.title;

	const date = document.createElement('p');
	date.className = 'modal-date';
	date.textContent = photo.date;

	const explanation = document.createElement('p');
	explanation.className = 'modal-explanation';
	explanation.textContent = getExplanationText(photo.explanation);

	details.append(title, date, explanation);
	imageModal.append(closeButton, image, details);
	imageModal.showModal();
}

// Close the modal when the user clicks its backdrop.
imageModal.addEventListener('click', (event) => {
	if (event.target === imageModal) {
		imageModal.close();
	}
});

// Build the gallery from image and video entries.
function showPhotos(photos) {
	const galleryPhotos = photos.filter((photo) =>
		(photo.media_type === 'image' && photo.hdurl) ||
		(photo.media_type === 'video' && photo.url)
	);
	gallery.replaceChildren();

	if (galleryPhotos.length === 0) {
		showMessage('No photos were found for these dates. Try another date range.');
		return;
	}

	galleryPhotos.forEach((photo) => {
		const card = document.createElement('article');
		card.className = 'gallery-item';

		const title = document.createElement('h2');
		title.className = 'gallery-title';
		title.textContent = photo.title;

		const date = document.createElement('p');
		date.className = 'gallery-date';
		date.textContent = photo.date;

		if (photo.media_type === 'video') {
			const watchLink = document.createElement('a');
			watchLink.className = 'watch-link';
			watchLink.href = photo.url;
			watchLink.target = '_blank';
			watchLink.rel = 'noopener noreferrer';
			watchLink.textContent = 'Watch on NASA';
			card.append(title, date, watchLink);
		} else {
			const imageButton = document.createElement('button');
			imageButton.className = 'image-button';
			imageButton.type = 'button';
			imageButton.setAttribute('aria-label', `View ${photo.title}`);

			const image = document.createElement('img');
			image.src = photo.hdurl;
			image.alt = photo.title;
			image.loading = 'lazy';
			imageButton.append(image);
			imageButton.addEventListener('click', () => openImageModal(photo));

			card.append(imageButton, title, date);
		}

		gallery.append(card);
	});
}

// Load the selected dates when the button is clicked.
getImagesButton.addEventListener('click', async () => {
	if (!datesAreValid()) {
		showMessage('Choose a valid start and end date. The start date must be on or before the end date.');
		return;
	}

	getImagesButton.disabled = true;
	showMessage('Loading space photos…');
	gallery.setAttribute('aria-busy', 'true');

	try {
		const photos = await getApodPhotos(startInput.value, endInput.value);
		showPhotos(photos);
	} catch (error) {
		showMessage(error.message || 'The NASA photo request failed. Please try again.');
	} finally {
		gallery.setAttribute('aria-busy', 'false');
		getImagesButton.disabled = false;
	}
});
