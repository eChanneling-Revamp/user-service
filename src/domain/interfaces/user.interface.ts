export interface IUserRepository {
  findById(id: string): Promise<any>;
  findByEmail(email: string): Promise<any>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<boolean>;
  search(query: { q?: string; page?: number; limit?: number }): Promise<{ items: any[]; total: number; page: number; limit: number }>;
}