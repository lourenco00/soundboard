export default function Paywall({ title, children }: { title: string, children?: React.ReactNode }) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">
          This feature is available on <b>Pro</b>. Upgrade to unlock longer recordings,
          more custom pads, and larger uploads.
        </p>
        <form action="/api/create-checkout" method="POST">
          <button className="btn-primary rounded-xl">Upgrade to Pro</button>
        </form>
        {children}
      </div>
    );
  }