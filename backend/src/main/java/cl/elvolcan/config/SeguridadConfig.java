package cl.elvolcan.config;
import cl.elvolcan.repository.UsuarioRepository;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.*;
import org.springframework.beans.factory.annotation.Value;
import java.util.List;
@Configuration
public class SeguridadConfig {
 @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder();}
 @Bean UserDetailsService usuarios(UsuarioRepository repo){return nombre->repo.findByUsuario(nombre).filter(u->u.getActivo()).map(u->User.withUsername(u.getUsuario()).password(u.getPasswordHash()).roles(u.getRol().name()).build()).orElseThrow(()->new UsernameNotFoundException("Credenciales invalidas"));}
 @Bean SecurityFilterChain seguridad(HttpSecurity http) throws Exception {
  // Provisional para Swagger/Postman local; JWT y renovacion pertenecen a Fase C.
  return http.cors(c->{}).csrf(c->c.disable()).sessionManagement(c->c.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
   .authorizeHttpRequests(a->a.requestMatchers("/swagger-ui/**","/swagger-ui.html","/v3/api-docs/**").permitAll()
    .requestMatchers(org.springframework.http.HttpMethod.GET,"/api/v1/productos/**").permitAll()
    .requestMatchers(org.springframework.http.HttpMethod.POST,"/api/v1/auth/registro").permitAll()
    .requestMatchers("/api/v1/admin/**").hasRole("ADMINISTRADOR").anyRequest().authenticated())
   .httpBasic(b->b.authenticationEntryPoint((req,res,e)->{res.setStatus(401);res.setContentType("application/problem+json");res.getWriter().write("{\"status\":401,\"code\":\"SIN_SESION\",\"detail\":\"Autenticacion requerida\"}");}))
   .exceptionHandling(e->e.accessDeniedHandler((req,res,x)->{res.setStatus(403);res.setContentType("application/problem+json");res.getWriter().write("{\"status\":403,\"code\":\"SIN_PERMISO\"}");})).build();
 }
 @Bean CorsConfigurationSource corsConfigurationSource(@Value("${app.cors.allowed-origin}") String origen){var c=new CorsConfiguration();c.setAllowedOrigins(List.of(origen));c.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH","OPTIONS"));c.setAllowedHeaders(List.of("Content-Type","Authorization"));var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/api/**",c);return source;}
}