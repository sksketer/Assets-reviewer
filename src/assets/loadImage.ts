export function loadImageFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;

  return img
    .decode()
    .then(() => {
      URL.revokeObjectURL(url);
      return img;
    })
    .catch(() => {
      URL.revokeObjectURL(url);
      throw new Error(`Failed to load image "${file.name}". The file may be corrupted or not a supported image format.`);
    });
}
