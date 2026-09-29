/** Create or edit a lost item report (REQ-9 to REQ-24). */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { lostApi } from '../api';
import { emptyReportForm, ReportForm, ReportFormValues } from '../components/ReportForm';
import { ErrorMessage, Loading, PageTitle } from '../components/ui';

export function LostReportFormPage() {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [initialValues, setInitialValues] = useState<ReportFormValues | null>(
    isEditing ? null : emptyReportForm,
  );
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When editing, load the current values into the form first.
  useEffect(() => {
    if (!id) return;
    lostApi
      .get(id)
      .then((report) => {
        setExistingPhotoUrl(report.photoUrl);
        setInitialValues({
          itemName: report.itemName,
          category: report.category,
          colour: report.colour,
          brand: report.brand ?? '',
          brandUnknown: report.brand === null,
          date: report.dateLost.slice(0, 10),
          location: {
            locationName: report.locationName,
            latitude: report.latitude,
            longitude: report.longitude,
          },
          privateDescription: report.privateDescription ?? '',
          notificationThreshold: report.notificationThreshold,
        });
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  async function handleSubmit(form: FormData) {
    const report = id ? await lostApi.update(id, form) : await lostApi.create(form);
    navigate(`/lost/${report.id}`);
  }

  if (error) return <ErrorMessage message={error} />;
  if (!initialValues) return <Loading />;

  return (
    <div>
      <PageTitle>{isEditing ? 'Edit lost item report' : 'Report a lost item'}</PageTitle>
      <ReportForm
        variant="lost"
        initialValues={initialValues}
        existingPhotoUrl={existingPhotoUrl}
        submitLabel={isEditing ? 'Save changes' : 'Submit report'}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
