type Props = {
  message: string;
};

export function ErrorMessage({ message }: Props) {
  return (
    <div className="rounded-lg border border-error/20 bg-error/10 p-4 text-sm text-error">
      {message}
    </div>
  );
}
