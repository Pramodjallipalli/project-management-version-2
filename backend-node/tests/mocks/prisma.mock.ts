const createModelMock = () => ({
  findMany: jest.fn().mockResolvedValue([]),
  findUnique: jest.fn().mockResolvedValue(null),
  findUniqueOrThrow: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: args?.where?.id || 'mock-id' })),
  findFirst: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mock-id', ...args?.data })),
  createMany: jest.fn().mockResolvedValue({ count: 1 }),
  update: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: args?.where?.id || 'mock-id', ...args?.data })),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  delete: jest.fn().mockResolvedValue({ id: 'deleted-id' }),
  deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  upsert: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mock-id', ...(args?.create || args?.update) })),
  count: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue({ _sum: {}, _avg: {}, _count: {} }),
  groupBy: jest.fn().mockResolvedValue([]),
});

export const mockPrisma: any = {
  organization: createModelMock(),
  organizationWorkPolicy: createModelMock(),
  user: createModelMock(),
  userRole: createModelMock(),
  userPermission: createModelMock(),
  role: createModelMock(),
  permission: createModelMock(),
  rolePermission: createModelMock(),
  userSession: createModelMock(),
  cohort: createModelMock(),
  project: createModelMock(),
  projectOwner: createModelMock(),
  projectMember: createModelMock(),
  projectMemberRole: createModelMock(),
  projectRole: createModelMock(),
  projectRolePermission: createModelMock(),
  projectDocument: createModelMock(),
  sprint: createModelMock(),
  workItem: createModelMock(),
  workItemAssignee: createModelMock(),
  workItemComment: createModelMock(),
  timeEntry: createModelMock(),
  workSession: createModelMock(),
  form: createModelMock(),
  formQuestion: createModelMock(),
  formSubmission: createModelMock(),
  formAnswer: createModelMock(),
  notification: createModelMock(),
  notificationRecipient: createModelMock(),
  actionItem: createModelMock(),
  auditLog: createModelMock(),
  workItemExtensionRequest: createModelMock(),
  documentRequirement: createModelMock(),
  bugReport: createModelMock(),
  bugReview: createModelMock(),
  bug: createModelMock(),
  bugAssignment: createModelMock(),
  bugRetest: createModelMock(),
  bugComment: createModelMock(),
  bugAttachment: createModelMock(),
  bugEvent: createModelMock(),
  $transaction: jest.fn(async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(mockPrisma);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  }),
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  $executeRaw: jest.fn().mockResolvedValue(1),
  $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
};

export function resetPrismaMock() {
  for (const key of Object.keys(mockPrisma)) {
    if (key.startsWith('$')) {
      if (typeof mockPrisma[key].mockClear === 'function') {
        mockPrisma[key].mockClear();
      }
    } else if (mockPrisma[key]) {
      for (const method of Object.keys(mockPrisma[key])) {
        if (typeof mockPrisma[key][method].mockReset === 'function') {
          mockPrisma[key][method].mockReset();
          // Restore default implementations
          if (method === 'findMany') mockPrisma[key][method].mockResolvedValue([]);
          else if (method === 'findUnique') mockPrisma[key][method].mockResolvedValue(null);
          else if (method === 'findFirst') mockPrisma[key][method].mockResolvedValue(null);
          else if (method === 'create') mockPrisma[key][method].mockImplementation((args: any) => Promise.resolve({ id: 'mock-id', ...args?.data }));
          else if (method === 'createMany') mockPrisma[key][method].mockResolvedValue({ count: 1 });
          else if (method === 'update') mockPrisma[key][method].mockImplementation((args: any) => Promise.resolve({ id: args?.where?.id || 'mock-id', ...args?.data }));
          else if (method === 'updateMany') mockPrisma[key][method].mockResolvedValue({ count: 1 });
          else if (method === 'delete') mockPrisma[key][method].mockResolvedValue({ id: 'deleted-id' });
          else if (method === 'deleteMany') mockPrisma[key][method].mockResolvedValue({ count: 1 });
          else if (method === 'upsert') mockPrisma[key][method].mockImplementation((args: any) => Promise.resolve({ id: 'mock-id', ...(args?.create || args?.update) }));
          else if (method === 'count') mockPrisma[key][method].mockResolvedValue(0);
          else if (method === 'aggregate') mockPrisma[key][method].mockResolvedValue({ _sum: {}, _avg: {}, _count: {} });
          else if (method === 'groupBy') mockPrisma[key][method].mockResolvedValue([]);
        }
      }
    }
  }

  mockPrisma.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(mockPrisma);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  });
  mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.$executeRawUnsafe.mockResolvedValue(1);
  mockPrisma.$connect.mockResolvedValue(undefined);
  mockPrisma.$disconnect.mockResolvedValue(undefined);
}

export function mockEntity(modelName: string, entity: any) {
  if (!mockPrisma[modelName]) return;
  mockPrisma[modelName].findUnique.mockImplementation((args: any) => {
    if (!args?.where) return Promise.resolve(entity);
    if (args.where.id && args.where.id !== entity.id) return Promise.resolve(null);
    return Promise.resolve(entity);
  });
  mockPrisma[modelName].findFirst.mockImplementation((args: any) => {
    if (!args?.where) return Promise.resolve(entity);
    if (args.where.id && args.where.id !== entity.id) return Promise.resolve(null);
    return Promise.resolve(entity);
  });
}

