interface PhoneShotProps {
  src: string;
  alt: string;
}

export default function PhoneShot({ src, alt }: PhoneShotProps) {
  return (
    <div className="phone">
      <img src={src} alt={alt} width={390} height={844} />
    </div>
  );
}
