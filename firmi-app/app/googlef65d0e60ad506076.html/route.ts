export function GET() {
  return new Response(
    'google-site-verification: googlef65d0e60ad506076.html',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}
