import RegistrationApp from '../../../registration/RegistrationApp';

export const metadata = {
  title: 'Directory dummy preview · Kuriake Castle',
  robots: { index: false, follow: false },
};

export default function DirectoryDemo() {
  return <RegistrationApp browse directoryDemo />;
}
