export const guardCheckboxMutation = (input, guardMutation, apply) => {
  const nextChecked = input.checked;
  input.checked = !nextChecked;
  guardMutation(() => {
    input.checked = nextChecked;
    apply();
  });
};
