type IconName =
  | 'plus'
  | 'list'
  | 'swipe'
  | 'check'
  | 'close'
  | 'link'
  | 'arrow-up'
  | 'arrow-right'
  | 'settings'
  | 'calendar'
  | 'bell'
  | 'cloud'
  | 'download'
  | 'refresh'
  | 'trash'
const paths: Record<IconName, string> = {
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  swipe: 'M8 7 6 19l11 2 2-12-11-2ZM8 3l11 2 2 11',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  'arrow-up': 'M12 20V4m-7 7 7-7 7 7',
  'arrow-right': 'M4 12h16m-7-7 7 7-7 7',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  calendar: 'M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  cloud: 'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5 5 0 0 1 0 11H6',
  download: 'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
}
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
