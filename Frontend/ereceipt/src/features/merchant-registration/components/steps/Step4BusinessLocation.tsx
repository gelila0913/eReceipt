import React, { useState } from 'react';
import { MapPin, Navigation, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import type { MerchantRegistrationFormData } from '../../types';
import styles from './Step4BusinessLocation.module.css';

interface Step4Props {
  formData: MerchantRegistrationFormData;
  onChange: (patch: Partial<MerchantRegistrationFormData>) => void;
}

export const Step4BusinessLocation: React.FC<Step4Props> = ({ formData, onChange }) => {
  const [gpsMessage, setGpsMessage] = useState(formData.gpsLocation || '');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'success' | 'error'>(
    formData.gpsLocation && formData.gpsLocation.includes(',') ? 'success' : 'idle'
  );

  const requestGpsLocation = async () => {
    setIsLocating(true);
    setGpsMessage('Detecting device GPS coordinates…');

    try {
      // 1. Check/request native Capacitor permissions if available
      try {
        const permStatus = await Geolocation.checkPermissions();
        if (permStatus.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location === 'denied') {
            throw new Error('Location permission was denied. Please allow location access in device settings.');
          }
        }
      } catch (permErr: any) {
        // Continue to getCurrentPosition in case permission is handled natively by WebView
      }

      // 2. Fetch coordinates via Capacitor (falls back to HTML5 geolocation automatically on web)
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
      });

      const lat = position.coords.latitude.toFixed(6);
      const lon = position.coords.longitude.toFixed(6);
      const coordsStr = `${lat}, ${lon}`;
      setGpsMessage(coordsStr);
      setGpsStatus('success');
      onChange({ gpsLocation: coordsStr });
    } catch (err: any) {
      // Fallback: standard browser geolocation if Capacitor failed
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude.toFixed(6);
            const lon = pos.coords.longitude.toFixed(6);
            const coordsStr = `${lat}, ${lon}`;
            setGpsMessage(coordsStr);
            setGpsStatus('success');
            onChange({ gpsLocation: coordsStr });
            setIsLocating(false);
          },
          () => {
            setIsLocating(false);
            setGpsStatus('error');
            setGpsMessage('Unable to access device location. You may continue or enter coordinates manually.');
            onChange({ gpsLocation: '' });
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
        return;
      }

      setGpsStatus('error');
      setGpsMessage(
        err?.message || 'GPS location could not be detected. You can continue or enter coordinates manually.'
      );
      onChange({ gpsLocation: '' });
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className={styles.stepContainer}>
      <label className="field-group">
        <span className="field-label">City</span>
        <input
          required
          type="text"
          className="field-input"
          autoComplete="off"
          placeholder="e.g. Addis Ababa"
          value={formData.city}
          onChange={(e) => onChange({ city: e.target.value })}
        />
      </label>

      <label className="field-group">
        <span className="field-label">Sub-city</span>
        <input
          required
          type="text"
          className="field-input"
          autoComplete="off"
          placeholder="e.g. Bole"
          value={formData.subCity}
          onChange={(e) => onChange({ subCity: e.target.value })}
        />
      </label>

      <label className="field-group">
        <span className="field-label">Building name</span>
        <input
          required
          type="text"
          className="field-input"
          autoComplete="off"
          placeholder="e.g. Morning Star Mall"
          value={formData.buildingName}
          onChange={(e) => onChange({ buildingName: e.target.value })}
        />
      </label>

      <label className="field-group">
        <span className="field-label">Floor</span>
        <input
          required
          type="text"
          className="field-input"
          autoComplete="off"
          placeholder="e.g. 2nd floor"
          value={formData.floor}
          onChange={(e) => onChange({ floor: e.target.value })}
        />
      </label>

      <div className={styles.gpsCard}>
        <div className={styles.gpsInner}>
          <span className={`${styles.gpsIconBox} ${gpsStatus === 'success' ? styles.gpsIconSuccess : ''}`}>
            {gpsStatus === 'success' ? (
              <CheckCircle2 size={22} className={styles.iconSuccess} />
            ) : (
              <Navigation size={20} className={isLocating ? styles.spinIcon : ''} />
            )}
          </span>
          <div className={styles.gpsDetails}>
            <div className={styles.gpsHeaderRow}>
              <p className={styles.gpsTitle}>
                Store & Building GPS <span className={styles.gpsOptional}>(recommended)</span>
              </p>
              {gpsStatus === 'success' && (
                <span className={styles.gpsVerifiedBadge}>
                  <CheckCircle2 size={12} /> Verified
                </span>
              )}
            </div>
            <p className={styles.gpsCopy}>
              Attach physical coordinates for tax branch identification and authorized receipts geofencing.
            </p>

            {gpsStatus === 'success' && formData.gpsLocation ? (
              <div className={styles.coordinatesChip}>
                <MapPin size={15} className={styles.chipPin} />
                <span className={styles.chipText}>{formData.gpsLocation}</span>
                <button
                  type="button"
                  className={styles.chipRefreshBtn}
                  onClick={requestGpsLocation}
                  title="Refresh location"
                >
                  <RefreshCw size={13} className={isLocating ? styles.spinIcon : ''} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`btn-secondary ${styles.gpsButton}`}
                onClick={requestGpsLocation}
                disabled={isLocating}
              >
                {isLocating ? (
                  <>
                    <RefreshCw size={15} className={styles.spinIcon} />
                    <span>Locating GPS…</span>
                  </>
                ) : (
                  <>
                    <Navigation size={15} />
                    <span>Share store GPS location</span>
                  </>
                )}
              </button>
            )}

            {gpsStatus === 'error' && gpsMessage && (
              <div className={styles.gpsErrorBanner}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{gpsMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step4BusinessLocation;
