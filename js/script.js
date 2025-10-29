document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const preview = document.getElementById('preview');
    const previewGrid = document.getElementById('previewGrid');
    const imageCount = document.getElementById('imageCount');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const backBtn = document.getElementById('backBtn');
    const convertSeparateBtn = document.getElementById('convertSeparateBtn');
    const convertMergedBtn = document.getElementById('convertMergedBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const successToast = document.getElementById('successToast');
    const toastMessage = document.getElementById('toastMessage');

    let uploadedImages = [];

    // Handle drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary-color)';
        dropZone.style.backgroundColor = 'var(--selected-color)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
        dropZone.style.backgroundColor = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.backgroundColor = '';
        handleFiles(e.dataTransfer.files);
    });

    // Handle browse button click
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Handle add more button
    function handleFiles(files) {
        if (files.length === 0) return;

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                showToast('Please upload image files only', 'error');
                continue;
            }

            if (file.size > 10 * 1024 * 1024) {
                showToast('File size should be less than 10MB', 'error');
                continue;
            }

            // Create a new FileReader
            const reader = new FileReader();
            
            reader.onload = (e) => {
                // Create an image element to verify the data
                const img = new Image();
                img.onload = () => {
                    uploadedImages.push({
                        id: Date.now() + Math.random(),
                        data: e.target.result,
                        name: file.name,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    });
                    updatePreview();
                };
                img.onerror = () => {
                    showToast('Error loading image: ' + file.name, 'error');
                };
                img.src = e.target.result;
            };
            
            reader.onerror = () => {
                showToast('Error reading file: ' + file.name, 'error');
            };
            
            reader.readAsDataURL(file);
        }
    }

    function updatePreview() {
        preview.style.display = 'block';
        dropZone.style.display = 'none';
        updateImageCount();
        updateButtonVisibility();
    }

    function updateImageCount() {
        imageCount.textContent = uploadedImages.length;
    }

    function updateButtonVisibility() {
        const singleBtn = document.getElementById('convertSingleBtn');
        const multipleButtons = document.getElementById('multipleButtons');

        if (uploadedImages.length === 1) {
            singleBtn.style.display = 'block';
            multipleButtons.style.display = 'none';
        } else if (uploadedImages.length > 1) {
            singleBtn.style.display = 'none';
            multipleButtons.style.display = 'flex';
        } else {
            singleBtn.style.display = 'none';
            multipleButtons.style.display = 'none';
        }
    }

    // Add event listener for Add More button
    addMoreBtn.addEventListener('click', () => {
        fileInput.click();
    });

    async function convertToPdf(images) {
        const pdfDoc = await PDFLib.PDFDocument.create();
        
        for (const image of images) {
            // Create a temporary canvas to handle the image data
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Create a temporary image to get proper dimensions
            const tempImg = new Image();
            await new Promise((resolve, reject) => {
                tempImg.onload = resolve;
                tempImg.onerror = reject;
                tempImg.src = image.data;
            });
            
            // Set canvas size to match image dimensions
            canvas.width = tempImg.naturalWidth;
            canvas.height = tempImg.naturalHeight;
            
            // Draw image onto canvas
            ctx.drawImage(tempImg, 0, 0);
            
            // Get image data as bytes
            const imageData = canvas.toDataURL('image/jpeg', 1.0);
            const base64Data = imageData.split(',')[1];
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

            // Embed image in PDF
            const img = await pdfDoc.embedJpg(imageBytes);
            const page = pdfDoc.addPage([canvas.width, canvas.height]);
            const { width, height } = page.getSize();
            const imgDims = img.scale(1);
            const scale = Math.min(
                width / imgDims.width,
                height / imgDims.height
            );

            page.drawImage(img, {
                x: 0,
                y: 0,
                width: imgDims.width * scale,
                height: imgDims.height * scale
            });
        }

        return await pdfDoc.save();
    }

    function downloadPDF(pdfBytes, filename) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showToast(message, type = 'success') {
        toastMessage.textContent = message;
        successToast.style.backgroundColor = type === 'success' ? 'var(--success-color)' : 'var(--error-color)';
        successToast.classList.add('show');
        setTimeout(() => {
            successToast.classList.remove('show');
        }, 3000);
    }

    // Handle single PDF conversion
    document.getElementById('convertSingleBtn').addEventListener('click', async () => {
        if (uploadedImages.length !== 1) {
            showToast('Something went wrong', 'error');
            return;
        }

        loadingOverlay.classList.add('active');
        loadingText.textContent = 'Creating PDF...';

        try {
            const pdfBytes = await convertToPdf([uploadedImages[0]]);
            const filename = uploadedImages[0].name.replace(/\.[^/.]+$/, '') + '.pdf';
            downloadPDF(pdfBytes, filename);
            showToast('PDF created successfully!');
        } catch (error) {
            console.error('Error converting to PDF:', error);
            showToast('Error creating PDF. Please try again.', 'error');
        } finally {
            loadingOverlay.classList.remove('active');
        }
    });

    // Handle separate PDFs conversion
    convertSeparateBtn.addEventListener('click', async () => {
        if (uploadedImages.length < 2) {
            showToast('Please add at least two images for separate PDFs', 'error');
            return;
        }

        loadingOverlay.classList.add('active');
        loadingText.textContent = 'Creating separate PDFs...';

        try {
            for (const image of uploadedImages) {
                const pdfBytes = await convertToPdf([image]);
                const filename = image.name.replace(/\.[^/.]+$/, '') + '.pdf';
                downloadPDF(pdfBytes, filename);
            }
            showToast('Separate PDFs created successfully!');
        } catch (error) {
            console.error('Error converting to PDFs:', error);
            showToast('Error creating PDFs. Please try again.', 'error');
        } finally {
            loadingOverlay.classList.remove('active');
        }
    });

    // Handle merged PDF conversion
    convertMergedBtn.addEventListener('click', async () => {
        if (uploadedImages.length === 0) {
            showToast('Please add some images first', 'error');
            return;
        }

        loadingOverlay.classList.add('active');
        loadingText.textContent = 'Creating merged PDF...';

        try {
            const pdfBytes = await convertToPdf(uploadedImages);
            downloadPDF(pdfBytes, 'merged_document.pdf');
            showToast('Merged PDF created successfully!');
        } catch (error) {
            console.error('Error converting to PDF:', error);
            showToast('Error creating PDF. Please try again.', 'error');
        } finally {
            loadingOverlay.classList.remove('active');
        }
    });
    // Add back button functionality
    backBtn.addEventListener('click', () => {
        preview.style.display = 'none';
        dropZone.style.display = 'block';
        previewGrid.innerHTML = '';
        uploadedImages = [];
        updateImageCount();
    });
});