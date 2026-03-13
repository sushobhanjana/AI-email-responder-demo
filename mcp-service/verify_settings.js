import { setSetting, getSetting } from './helpers/database.js';

async function verifySettings() {
    console.log('--- Verifying Settings Persistence ---');

    // Set test values
    setSetting('DIGEST_LOOKBACK_DAYS', '3');
    setSetting('MOM_MISSING_THRESHOLD_HOURS', '12');
    setSetting('INTERNAL_DOMAINS', 'internal.test, corp.test');
    setSetting('CLIENT_DOMAINS', 'customer.test');

    // Retrieve and verify
    console.log('DIGEST_LOOKBACK_DAYS:', getSetting('DIGEST_LOOKBACK_DAYS'));
    console.log('MOM_MISSING_THRESHOLD_HOURS:', getSetting('MOM_MISSING_THRESHOLD_HOURS'));
    console.log('INTERNAL_DOMAINS:', getSetting('INTERNAL_DOMAINS'));
    console.log('CLIENT_DOMAINS:', getSetting('CLIENT_DOMAINS'));

    if (getSetting('DIGEST_LOOKBACK_DAYS') === '3' && getSetting('INTERNAL_DOMAINS') === 'internal.test, corp.test') {
        console.log('Persistence Verified Successfully!');
    } else {
        console.error('Persistence Verification Failed!');
    }
    console.log('--------------------------------------');
}

verifySettings();
