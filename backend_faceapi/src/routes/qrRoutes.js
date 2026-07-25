import express from 'express';
import QRCode from 'qrcode';
import { logger } from '../utils/logger.js';

const router = express.Router();

// QR Code generation endpoint
router.post('/generate', async (req, res, next) => {
    try {
        const { data, options = {} } = req.body;

        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'No data provided for QR code generation'
            });
        }

        logger.info('📱 QR code generation request received');

        // Default QR code options
        const qrOptions = {
            type: options.type || 'image/png',
            quality: options.quality || 0.92,
            margin: options.margin || 1,
            color: {
                dark: options.darkColor || '#000000',
                light: options.lightColor || '#FFFFFF'
            },
            width: options.width || 256,
            errorCorrectionLevel: options.errorCorrectionLevel || 'M'
        };

        // Generate QR code
        const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);

        // Generate QR code as buffer for other formats if needed
        let qrCodeBuffer = null;
        if (options.format === 'buffer' || options.includeBuffer) {
            qrCodeBuffer = await QRCode.toBuffer(data, qrOptions);
        }

        const response = {
            success: true,
            data: {
                originalData: data,
                qrCode: qrCodeDataURL,
                options: qrOptions,
                timestamp: new Date().toISOString()
            }
        };

        // Include buffer in base64 format if requested
        if (qrCodeBuffer) {
            response.data.qrCodeBuffer = qrCodeBuffer.toString('base64');
        }

        logger.info(`📱 QR code generated successfully for data length: ${data.length}`);

        res.json(response);

    } catch (error) {
        logger.error('❌ QR code generation failed:', error);
        next(error);
    }
});

// QR Code generation with custom styling
router.post('/generate/styled', async (req, res, next) => {
    try {
        const { data, style = {} } = req.body;

        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'No data provided for QR code generation'
            });
        }

        logger.info('📱 Styled QR code generation request received');

        // Advanced styling options
        const qrOptions = {
            type: 'image/png',
            quality: 0.92,
            margin: style.margin || 2,
            color: {
                dark: style.foregroundColor || '#1a365d',
                light: style.backgroundColor || '#ffffff'
            },
            width: style.size || 300,
            errorCorrectionLevel: style.errorCorrectionLevel || 'H' // Higher for styled codes
        };

        // Generate the QR code
        const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);

        const response = {
            success: true,
            data: {
                originalData: data,
                qrCode: qrCodeDataURL,
                style: qrOptions,
                timestamp: new Date().toISOString(),
                usage: 'This QR code can be used for Singapore Science Centre navigation'
            }
        };

        logger.info(`📱 Styled QR code generated successfully`);

        res.json(response);

    } catch (error) {
        logger.error('❌ Styled QR code generation failed:', error);
        next(error);
    }
});

// SSC Website QR code generator (specific use case)
router.post('/ssc-website', async (req, res, next) => {
    try {
        const { exhibit, language = 'en', additionalParams = {} } = req.body;

        // Build SSC website URL
        let baseUrl = 'https://www.science.edu.sg';

        if (exhibit) {
            // Add exhibit-specific path
            baseUrl += `/exhibits/${exhibit}`;
        }

        // Add language parameter
        const urlParams = new URLSearchParams({
            lang: language,
            source: 'qr_hologram',
            ...additionalParams
        });

        const fullUrl = `${baseUrl}?${urlParams.toString()}`;

        logger.info(`📱 Generating QR code for SSC website: ${fullUrl}`);

        // Generate QR code with SSC branding
        const qrOptions = {
            type: 'image/png',
            quality: 0.95,
            margin: 2,
            color: {
                dark: '#0066cc', // SSC blue
                light: '#ffffff'
            },
            width: 400,
            errorCorrectionLevel: 'H'
        };

        const qrCodeDataURL = await QRCode.toDataURL(fullUrl, qrOptions);

        const response = {
            success: true,
            data: {
                url: fullUrl,
                qrCode: qrCodeDataURL,
                exhibit,
                language,
                timestamp: new Date().toISOString(),
                instructions: 'Scan this QR code to visit the Singapore Science Centre website'
            }
        };

        logger.info(`📱 SSC website QR code generated successfully`);

        res.json(response);

    } catch (error) {
        logger.error('❌ SSC website QR code generation failed:', error);
        next(error);
    }
});

// Batch QR code generation
router.post('/generate/batch', async (req, res, next) => {
    try {
        const { items, options = {} } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No items provided for batch QR code generation'
            });
        }

        if (items.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 QR codes can be generated in a single batch'
            });
        }

        logger.info(`📱 Batch QR code generation request for ${items.length} items`);

        const qrOptions = {
            type: 'image/png',
            quality: 0.92,
            margin: options.margin || 1,
            color: {
                dark: options.darkColor || '#000000',
                light: options.lightColor || '#FFFFFF'
            },
            width: options.width || 256,
            errorCorrectionLevel: options.errorCorrectionLevel || 'M'
        };

        // Generate QR codes for all items
        const results = await Promise.all(
            items.map(async (item, index) => {
                try {
                    const qrCode = await QRCode.toDataURL(item.data || item, qrOptions);
                    return {
                        index,
                        data: item.data || item,
                        qrCode,
                        success: true,
                        id: item.id || `qr_${index}`
                    };
                } catch (error) {
                    logger.error(`❌ Failed to generate QR code for item ${index}:`, error);
                    return {
                        index,
                        data: item.data || item,
                        success: false,
                        error: error.message,
                        id: item.id || `qr_${index}`
                    };
                }
            })
        );

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        logger.info(`📱 Batch generation complete: ${successful.length} successful, ${failed.length} failed`);

        res.json({
            success: true,
            data: {
                total: items.length,
                successful: successful.length,
                failed: failed.length,
                results,
                options: qrOptions,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('❌ Batch QR code generation failed:', error);
        next(error);
    }
});

export { router as qrRoutes };