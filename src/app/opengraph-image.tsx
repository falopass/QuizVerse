import LocaleOpenGraphImage, { size, contentType } from './[locale]/opengraph-image';

export { size, contentType };

export default function OpenGraphImage() {
  return LocaleOpenGraphImage({ params: Promise.resolve({ locale: 'en' }) });
}
