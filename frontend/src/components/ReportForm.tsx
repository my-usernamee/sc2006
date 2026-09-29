/**
 * The shared form for both Lost Item Reports and Found Item Reports.
 * The two differ in only three ways, controlled by the `variant` prop:
 *   - lost reports have a notification threshold (REQ-20)
 *   - lost reports have an optional photo (REQ-17), found reports require one (REQ-30)
 *   - the date field is labelled "date lost" or "date found"
 */
import { FormEvent, useState } from 'react';
import { CATEGORIES, COLOURS, prettyLabel } from '../types';
import { MapPicker, SelectedLocation } from './MapPicker';
import { ErrorMessage } from './ui';

export interface ReportFormValues {
  itemName: string;
  category: string;
  colour: string;
  brand: string;
  brandUnknown: boolean;
  date: string; // YYYY-MM-DD
  location: SelectedLocation | null;
  privateDescription: string;
  notificationThreshold: number;
}

export const emptyReportForm: ReportFormValues = {
  itemName: '',
  category: '',
  colour: '',
  brand: '',
  brandUnknown: false,
  date: '',
  location: null,
  privateDescription: '',
  notificationThreshold: 60,
};

export function ReportForm({
  variant,
  initialValues,
  existingPhotoUrl,
  submitLabel,
  onSubmit,
}: {
  variant: 'lost' | 'found';
  initialValues?: ReportFormValues;
  existingPhotoUrl?: string | null;
  submitLabel: string;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const [values, setValues] = useState<ReportFormValues>(initialValues ?? emptyReportForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLost = variant === 'lost';
  const today = new Date().toISOString().slice(0, 10);

  function update<K extends keyof ReportFormValues>(field: K, value: ReportFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // REQ-21 / REQ-36: stop the submission if a required field is missing.
    if (!values.location) {
      setError('Please mark the location on the map.');
      return;
    }
    // REQ-30: a found report must have a photo.
    if (!isLost && !photo && !existingPhotoUrl) {
      setError('A photograph of the found item is required.');
      return;
    }

    // The form is sent as multipart because it may carry an image.
    const form = new FormData();
    form.set('itemName', values.itemName);
    form.set('category', values.category);
    form.set('colour', values.colour);
    form.set('brand', values.brand);
    form.set('brandUnknown', String(values.brandUnknown));
    form.set(isLost ? 'dateLost' : 'dateFound', values.date);
    form.set('locationName', values.location.locationName);
    form.set('latitude', String(values.location.latitude));
    form.set('longitude', String(values.location.longitude));
    form.set('privateDescription', values.privateDescription);
    if (isLost) form.set('notificationThreshold', String(values.notificationThreshold));
    if (photo) form.set('photo', photo);

    setSaving(true);
    try {
      await onSubmit(form);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorMessage message={error} />

      <div>
        <label className="label">Item name</label>
        <input
          className="input"
          required
          maxLength={100}
          value={values.itemName}
          onChange={(e) => update('itemName', e.target.value)}
          placeholder="e.g. Black backpack"
        />
      </div>

      {/* REQ-11: fixed category list */}
      <div>
        <label className="label">Category</label>
        <select
          className="input"
          required
          value={values.category}
          onChange={(e) => update('category', e.target.value)}
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {prettyLabel(c)}
            </option>
          ))}
        </select>
      </div>

      {/* REQ-12: fixed colour list */}
      <div>
        <label className="label">Colour</label>
        <select
          className="input"
          required
          value={values.colour}
          onChange={(e) => update('colour', e.target.value)}
        >
          <option value="">Select a colour</option>
          {COLOURS.map((c) => (
            <option key={c} value={c}>
              {prettyLabel(c)}
            </option>
          ))}
        </select>
      </div>

      {/* REQ-16 / REQ-29: a brand, or explicitly "Unknown" */}
      <div>
        <label className="label">Brand</label>
        <input
          className="input"
          maxLength={60}
          disabled={values.brandUnknown}
          value={values.brandUnknown ? '' : values.brand}
          onChange={(e) => update('brand', e.target.value)}
          placeholder={values.brandUnknown ? 'Unknown' : 'e.g. Herschel'}
        />
        <label className="t-sub mt-2.5 flex items-center gap-2.5 px-0.5">
          <input
            type="checkbox"
            className="h-[19px] w-[19px] rounded-md"
            style={{ accentColor: 'var(--blue)' }}
            checked={values.brandUnknown}
            onChange={(e) => update('brandUnknown', e.target.checked)}
          />
          I do not know the brand
        </label>
      </div>

      {/* REQ-13 / REQ-31: the date is typed in by the user */}
      <div>
        <label className="label">{isLost ? 'Date lost' : 'Date found'}</label>
        <input
          type="date"
          className="input"
          required
          max={today}
          value={values.date}
          onChange={(e) => update('date', e.target.value)}
        />
      </div>

      {/* REQ-14 / REQ-32: the location is chosen on the OneMap map */}
      <div>
        <label className="label">{isLost ? 'Where you lost it' : 'Where you found it'}</label>
        <MapPicker value={values.location} onChange={(loc) => update('location', loc)} />
      </div>

      <div>
        <label className="label">
          Photo {isLost ? '(optional)' : '(required)'}
        </label>
        {existingPhotoUrl && !photo && (
          <img
            src={existingPhotoUrl}
            alt="Current"
            className="mb-2.5 h-28 w-28 rounded-xl object-cover"
          />
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="input"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* REQ-18 / REQ-34: optional private description */}
      <div>
        <label className="label">Unique identifying description (optional)</label>
        <textarea
          className="input"
          rows={3}
          maxLength={500}
          value={values.privateDescription}
          onChange={(e) => update('privateDescription', e.target.value)}
          placeholder="Something only the real owner would know, e.g. a sticker or a scratch."
        />
        {/* REQ-19 / REQ-35 */}
        <p className="t-caption mt-2 px-0.5">
          Kept private. It is never shown when browsing, and is only revealed to the finder while
          they review an ownership claim.
        </p>
      </div>

      {/* REQ-20: notification threshold, lost reports only */}
      {isLost && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label className="label mb-0">Notify me from a match score of</label>
            <span
              className="text-[19px] font-semibold tabular-nums"
              style={{ color: 'var(--blue)' }}
            >
              {values.notificationThreshold}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            className="slider"
            value={values.notificationThreshold}
            onChange={(e) => update('notificationThreshold', Number(e.target.value))}
          />
          <p className="t-caption mt-2 px-0.5">
            A lower number means more notifications, including weaker matches.
          </p>
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? 'Saving...' : submitLabel}
      </button>
      <div className="h-1" />
    </form>
  );
}
