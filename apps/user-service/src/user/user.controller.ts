import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { UserService } from './user.service';
import { CreateUserDto, GetUserByIdDto } from './dto/user.dto';
import { User } from '@prisma/client';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: any): Promise<any> {
    try {
      const dto = new CreateUserDto();
      dto.email = data.email;
      dto.name = data.name;

      const user = await this.userService.createUser(dto);
      return this.mapUserToProto(user);
    } catch (error) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: error.message,
      });
    }
  }

  @GrpcMethod('UserService', 'GetUserById')
  async getUserById(data: any): Promise<any> {
    try {
      const dto = new GetUserByIdDto();
      dto.userId = data.user_id;

      const user = await this.userService.getUserById(dto);
      return this.mapUserToProto(user);
    } catch (error) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: error.message,
      });
    }
  }

  /**
   * Convert User entity to gRPC proto format
   * Converts createdAt Date to milliseconds timestamp
   */
  private mapUserToProto(user: User): any {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.createdAt.getTime(),
    };
  }
}
