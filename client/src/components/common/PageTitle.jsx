export default function PageTitle({ title, subtitle, action }) {
  return (
    <div className="title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {action}
    </div>
  );
}
