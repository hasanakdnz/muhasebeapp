import Link from "next/link";
import { Mail, MessageCircle, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  paylasimKonusu,
  paylasimMetni,
  whatsappNumarasi,
} from "@/lib/domain/proforma";

/**
 * Teklif paylaşımı.
 *
 * ROADMAP "PDF proforma şablonu + WhatsApp/e-posta paylaşım" istiyor. Uygulama
 * dışarıya dosya SUNMADIĞI için (bulut depolama CLAUDE.md gereği Faz 9'a
 * ertelendi) belge, yazdırma penceresinden PDF olarak alınır; WhatsApp ve
 * e-posta bağlantıları ise teklifi özetleyen hazır bir mesaj açar, kullanıcı
 * PDF'i o mesaja ekler. Böylece hiçbir finansal evrak izinsiz bir dış servise
 * yüklenmiş olmaz.
 *
 * Sunucu bileşeni: yalnızca bağlantı üretir, istemci JS'i gerektirmez.
 */
export function ProformaPaylas({
  id,
  no,
  cariUnvan,
  cariEmail,
  cariTelefon,
  firmaUnvani,
  toplamTutar,
  gecerlilikTarihi,
}: {
  id: string;
  no: string;
  cariUnvan: string;
  cariEmail: string | null;
  cariTelefon: string | null;
  firmaUnvani: string;
  /** Biçimlendirilmiş tutar (₺ dahil) — mesaj gövdesinde okunur haliyle geçer. */
  toplamTutar: string;
  gecerlilikTarihi: string | null;
}) {
  const metin = paylasimMetni({
    no,
    firmaUnvani,
    cariUnvan,
    toplamTutar,
    gecerlilikTarihi,
  });
  const konu = paylasimKonusu(no, firmaUnvani);

  const numara = whatsappNumarasi(cariTelefon);
  const whatsapp = `https://wa.me/${numara ?? ""}?text=${encodeURIComponent(metin)}`;
  const eposta = `mailto:${cariEmail ?? ""}?subject=${encodeURIComponent(
    konu
  )}&body=${encodeURIComponent(metin)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/proformalar/${id}/yazdir`}
        className={buttonVariants({ variant: "secondary" })}
      >
        <Printer />
        Yazdır / PDF
      </Link>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "text" })}
        title={
          numara
            ? undefined
            : "Carinin telefonu kayıtlı değil; alıcıyı WhatsApp'ta siz seçersiniz."
        }
      >
        <MessageCircle />
        WhatsApp
      </a>
      <a
        href={eposta}
        className={buttonVariants({ variant: "text" })}
        title={
          cariEmail
            ? undefined
            : "Carinin e-postası kayıtlı değil; alıcıyı siz yazarsınız."
        }
      >
        <Mail />
        E-posta
      </a>
    </div>
  );
}
