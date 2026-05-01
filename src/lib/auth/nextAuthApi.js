import auth from "@/pages/api/auth/[...nextauth]";

export function handleNextAuthAction(action) {
  const nextauth = Array.isArray(action) ? action : [action];

  return function nextAuthActionHandler(req, res) {
    req.query = {
      ...req.query,
      nextauth,
    };

    return auth(req, res);
  };
}
