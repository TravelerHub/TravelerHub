/**
 * PublicStory — unauthenticated wrapper around StoryMode.
 *
 * Route: /story/public/:token
 *
 * No login required. Fetches the story via the public backend endpoint
 * GET /public/story/:token.
 */
import StoryMode from '../../components/StoryMode.jsx';

export default function PublicStory() {
  return <StoryMode isPublic={true} />;
}
