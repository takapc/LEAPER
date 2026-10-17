export const LOCAL_STUDY_CHANGE = 'leaper-local-study-change'
export const REMOTE_STUDY_CHANGE = 'leaper-remote-study-change'

export function notifyStudyChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LOCAL_STUDY_CHANGE))
}
