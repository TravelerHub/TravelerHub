export const PollOptionType = {
  id: 0,
  text: "",
  description: "",
  vote_count: 0
};

export const PollType = {
  id: 0,
  title: "",
  description: "",
  is_active: true,
  options: [],
  user_vote_id: null
};

export const VoteType = {
  poll_id: 0,
  option_id: 0
};