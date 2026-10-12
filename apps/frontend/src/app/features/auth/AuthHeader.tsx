import Image from 'next/image';
import { useTranslations } from 'next-intl';

type AuthHeaderProps = {
  title: string;
  subtitle: string;
};

export default function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  const t = useTranslations('Common');
  return (
    <header className="auth-header">
      <Image src="/tempoo_icon.png" alt={t('logoAlt')} width={74} height={74} />
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
