export const limits = {
  auth: {
    email: 254,
    phone: 50,
    password: 200,
    firstName: 80,
    lastName: 80,
    middleName: 120,
    companyName: 200,
  },
  user: {
    email: 254,
    phone: 50,
    firstName: 80,
    lastName: 80,
    middleName: 120,
    companyName: 200,
  },
  application: {
    clientFullName: 200,
    clientPhone: 50,
    comment: 2000,
  },
  property: {
    title: 500,
    region: 200,
    city: 200,
    street: 500,
    plotNumber: 200,
    description: 20000,
  },
  news: {
    title: 200,
    subtitle: 200,
    excerpt: 2000,
    content: 50000,
  },
  events: {
    title: 200,
    location: 200,
    description: 10000,
  },
};
