export function NotificationPreview({
  title,
  subtitle,
  timestamp,
}: {
  title: string;
  subtitle: string;
  timestamp?: string;
}) {
  return (
    <div className="flex items-start space-x-3 relative">
      <img
        src="/icon.png"
        alt="Notification icon"
        className="w-10 h-10 rounded-sm"
      />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </div>
      {timestamp && (
        <span className="text-gray-600 absolute right-4">{timestamp}</span>
      )}
    </div>
  );
}
