package cl.elvolcan.config;
import org.springframework.context.annotation.*;
import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.*;
@Configuration
public class OpenApiConfig {
 @Bean OpenAPI api(){return new OpenAPI().info(new Info().title("Distribuidora de Gas El Volcan").version("1.0").description("Fase A. DELETE desactiva productos. HTTP Basic local provisional; JWT pendiente."))
 .components(new Components().addSecuritySchemes("basic",new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("basic")));
 }
}