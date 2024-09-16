export const idlFactory = ({ IDL }) => {
  return IDL.Service({ 'greet' : IDL.Func([], [IDL.Text], []) });
};
export const init = ({ IDL }) => { return []; };
