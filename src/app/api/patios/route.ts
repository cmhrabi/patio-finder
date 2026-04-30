import seed from '@/data/seedPatios.json';

export async function GET() {
  return Response.json(seed);
}
