import { redirect } from 'next/navigation'

/** Legacy promo URL — marketing home now lives at `/`. */
export default function WelcomePage() {
  redirect('/')
}
