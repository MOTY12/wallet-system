import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';

export interface UserServiceClient {
  GetUserById(request: { user_id: string }): Observable<any>;
}

@Injectable()
export class UserServiceClient implements OnModuleInit {
  private userService: UserServiceClient;

  constructor(@Inject('USER_SERVICE') private client: ClientGrpc) {}

  onModuleInit() {
    this.userService = this.client.getService<UserServiceClient>('UserService');
  }

  /**
   * Verify that a user exists by calling the User Service
   * Throws error if user doesn't exist or service is unreachable
   */
  getUserById(userId: string): Observable<any> {
    return this.userService.GetUserById({ user_id: userId });
  }
}
