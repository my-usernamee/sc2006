/** Create or edit a found item report (REQ-26 to REQ-39). */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { foundApi } from '../api';
import { emptyReportForm, ReportForm, ReportFormValues } from '../components/ReportForm';
import { ErrorMessage, Loading, PageTitle } from '../components/ui';

export function FoundReportFormPage() {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [initialValues, setInitialValues] = useState<ReportFormValues | null>(
    isEditing ? null : emptyReportForm,
  );
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    foundApi
      .get(id)
      .then((report) => {
        setExistingPhotoUrl(report.photoUrl);
        setInitialValues({
          itemName: report.itemName,
          category: report.category,
          colour: report.colour,
          brand: report.brand ?? '',
          brandUnknown: report.brand === null,
          date: report.dateFound.slice(0, 10),
          location: {
            locationName: report.locationName,
            latitude: report.latitude,
            longitude: report.longitude,
          },
          privateDescription: report.privateDescription ?? '',
          notificationThreshold: 0, // not used by found reports
        });
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  async function handleSubmit(form: FormData) {
    const report = id ? await foundApi.update(id, form) : await foundApi.create(form);
    navigate(`/found/${report.id}`);
  }

  if (error) return <ErrorMessage message={error} />;
  if (!initialValues) return <Loading />;

  return (
    <div>
      <PageTitle>{isEditing ? 'Edit found item report' : 'Report a found item'}</PageTitle>
      <ReportForm
        variant="found"
        initialValues={initialValues}
        existingPhotoUrl={existingPhotoUrl}
        submitLabel={isEditing ? 'Save changes' : 'Submit report'}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
